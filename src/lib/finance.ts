import { z } from "zod";
import type { Assumptions } from "./types";
export const modelSchema = z
  .object({
    revenue: z.number().positive(),
    growth: z.number().min(-0.5).max(0.5),
    margin: z.number().gt(0).max(0.8),
    taxRate: z.number().min(0).max(0.6),
    daRate: z.number().min(0).max(0.3),
    capexRate: z.number().min(0).max(0.5),
    nwcRate: z.number().min(-0.5).max(0.8),
    wacc: z.number().min(0.03).max(0.4),
    terminalGrowth: z.number().min(-0.05).max(0.06),
    shares: z.number().positive(),
    netDebt: z.number(),
    currency: z.literal("USD"),
  })
  .refine((a) => a.wacc > a.terminalGrowth, {
    message: "WACC должен быть выше terminal growth",
  });
export function dcf(input: Assumptions) {
  const a = modelSchema.parse(input);
  let prev = a.revenue;
  const years = Array.from({ length: 5 }, (_, i) => {
    const revenue = prev * (1 + a.growth);
    const ebit = revenue * a.margin;
    const nopat = ebit * (1 - a.taxRate),
      da = revenue * a.daRate,
      capex = revenue * a.capexRate,
      deltaNwc = (revenue - prev) * a.nwcRate;
    const fcff = nopat + da - capex - deltaNwc;
    prev = revenue;
    return {
      year: i + 1,
      revenue,
      ebit,
      nopat,
      da,
      capex,
      deltaNwc,
      fcff,
      pv: fcff / (1 + a.wacc) ** (i + 1),
    };
  });
  // Year 6 uses terminal growth for working-capital reinvestment as well as revenue.
  const rev6 = years[4].revenue * (1 + a.terminalGrowth);
  const fcff6 =
    rev6 * (a.margin * (1 - a.taxRate) + a.daRate - a.capexRate) -
    (rev6 - years[4].revenue) * a.nwcRate;
  if (fcff6 <= 0 || years.some((y) => y.fcff <= 0))
    throw new Error(
      "Стандартная FCFF DCF требует положительного денежного потока",
    );
  const terminal = fcff6 / (a.wacc - a.terminalGrowth),
    terminalPv = terminal / (1 + a.wacc) ** 5;
  const ev = years.reduce((s, y) => s + y.pv, 0) + terminalPv,
    equity = ev - a.netDebt;
  const fairValue = equity / a.shares;
  // One-year bridge: EV accretes at WACC, year-one unlevered cash is distributed,
  // net debt and diluted shares remain fixed. This is a stated model assumption.
  const target12m = (ev * (1 + a.wacc) - years[0].fcff - a.netDebt) / a.shares;
  return {
    years,
    fcff6,
    terminal,
    terminalPv,
    ev,
    equity,
    fairValue,
    target12m,
    terminalShare: terminalPv / ev,
  };
}
export function reverseDcf(a: Assumptions, price: number) {
  if (!Number.isFinite(price) || price <= 0) return null;
  let lo = -0.45,
    hi = 0.5;
  const value = (g: number) => {
    try {
      return dcf({ ...a, growth: g }).fairValue - price;
    } catch {
      return null;
    }
  };
  let fLo = value(lo),
    fHi = value(hi);
  if (fLo === null || fHi === null || fLo * fHi > 0) return null;
  for (let i = 0; i < 90; i++) {
    const mid = (lo + hi) / 2,
      f = value(mid);
    if (f === null) return null;
    if (Math.abs(f) < 1e-8) return mid;
    if (fLo * f <= 0) hi = mid;
    else {
      lo = mid;
      fLo = f;
    }
  }
  return (lo + hi) / 2;
}
export function scenarios(a: Assumptions) {
  return [
    {
      name: "Bear",
      assumptions: {
        ...a,
        growth: Math.max(-0.4, a.growth - 0.04),
        margin: Math.max(0.01, a.margin - 0.03),
        wacc: a.wacc + 0.01,
      },
    },
    { name: "Base", assumptions: a },
    {
      name: "Bull",
      assumptions: {
        ...a,
        growth: Math.min(0.5, a.growth + 0.04),
        margin: Math.min(0.8, a.margin + 0.03),
        wacc: Math.max(0.03, a.wacc - 0.005),
      },
    },
  ].map((s) => {
    try {
      const v = dcf(s.assumptions);
      return {
        ...s,
        fairValue: v.fairValue,
        target12m: v.target12m,
        error: null,
      };
    } catch (e) {
      return {
        ...s,
        fairValue: null,
        target12m: null,
        error: e instanceof Error ? e.message : "Неприменимый сценарий",
      };
    }
  });
}
export function sensitivity(a: Assumptions) {
  return [-0.01, -0.005, 0, 0.005, 0.01].map((w) => ({
    wacc: a.wacc + w,
    values: [-0.01, -0.005, 0, 0.005, 0.01].map((g) => {
      try {
        return dcf({
          ...a,
          wacc: a.wacc + w,
          terminalGrowth: a.terminalGrowth + g,
        }).fairValue;
      } catch {
        return null;
      }
    }),
  }));
}
export function allocate(bps: number[], capital = 100000) {
  if (
    !bps.length ||
    bps.some((b) => !Number.isInteger(b) || b < 0) ||
    bps.reduce((a, b) => a + b, 0) !== 10000
  )
    throw new Error("Веса должны составлять 10000 базисных пунктов (100%)");
  const cents = Math.round(capital * 100),
    raw = bps.map((b) => (cents * b) / 10000),
    out = raw.map(Math.floor);
  const sorted = raw
    .map((x, i) => ({ i, remainder: x - out[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const remaining = cents - out.reduce((a, b) => a + b, 0);
  for (let j = 0; j < remaining; j++) out[sorted[j % sorted.length].i]++;
  return out.map((x) => x / 100);
}
export function technicals(
  bars: { date: string; close: number; volume: number }[],
) {
  if (
    bars.some(
      (b) =>
        !Number.isFinite(b.close) ||
        b.close <= 0 ||
        !Number.isFinite(b.volume) ||
        b.volume < 0,
    )
  )
    throw new Error("Некорректные OHLCV");
  if (new Set(bars.map((b) => b.date)).size !== bars.length)
    throw new Error("Повторяющиеся даты");
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.slice(-60);
  const sma = (n: number) =>
    sorted.length < n
      ? null
      : sorted.slice(-n).reduce((a, b) => a + b.close, 0) / n;
  return {
    sma50: sma(50),
    sma200: sma(200),
    support: last.length >= 20 ? Math.min(...last.map((b) => b.close)) : null,
    resistance:
      last.length >= 20 ? Math.max(...last.map((b) => b.close)) : null,
    avgDollarVolume:
      sorted.length >= 60
        ? last.reduce((a, b) => a + b.close * b.volume, 0) / last.length
        : null,
  };
}

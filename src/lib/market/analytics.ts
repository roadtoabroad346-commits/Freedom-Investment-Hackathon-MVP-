import type { MarketBar, Workspace } from "./schema";
import type { Instrument } from "../types";
export function seriesMetrics(bars: MarketBar[]) {
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  let peak = 0,
    worst = 0;
  const returns: number[] = [];
  const points = sorted.map((b, i) => {
    peak = Math.max(peak, b.close);
    const drawdown = b.close / peak - 1;
    worst = Math.min(worst, drawdown);
    if (i) returns.push(b.close / sorted[i - 1].close - 1);
    const sma = (n: number) =>
      i + 1 < n
        ? null
        : sorted.slice(i - n + 1, i + 1).reduce((s, x) => s + x.close, 0) / n;
    return {
      ...b,
      drawdown: drawdown * 100,
      normalized: (b.close / sorted[0].close) * 100,
      sma20: sma(20),
      sma50: sma(50),
      change: i ? b.close / sorted[i - 1].close - 1 : null,
    };
  });
  // No annualization: intervals may be irregular or weekly. Sample volatility is per observation.
  const mean = returns.length
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : null;
  const volatility =
    returns.length >= 2
      ? Math.sqrt(
          returns.reduce((s, r) => s + (r - mean!) ** 2, 0) /
            (returns.length - 1),
        )
      : null;
  return {
    points,
    first: sorted[0] ?? null,
    last: sorted.at(-1) ?? null,
    change:
      sorted.length >= 2 ? sorted.at(-1)!.close / sorted[0].close - 1 : null,
    maxDrawdown: sorted.length >= 2 ? worst : null,
    volatility,
    observations: returns.length,
  };
}
export function alignedComparison(bars: MarketBar[], tickers: string[]) {
  const maps = tickers.map(
    (t) =>
      new Map(bars.filter((b) => b.ticker === t).map((b) => [b.date, b.close])),
  );
  if (!maps.length) return [];
  const dates = [...maps[0].keys()]
    .filter((d) => maps.every((m) => m.has(d)))
    .sort();
  return dates.map(
    (date) =>
      Object.fromEntries([
        ["date", date],
        ...tickers.map((t, i) => [
          t,
          (maps[i].get(date)! / maps[i].get(dates[0])!) * 100,
        ]),
      ]) as { date: string; [key: string]: string | number },
  );
}
export function portfolioMetrics(w: Workspace) {
  const latest = new Map<string, MarketBar>();
  for (const b of w.bars)
    if (!latest.has(b.ticker) || latest.get(b.ticker)!.date < b.date)
      latest.set(b.ticker, b);
  const rows = w.positions.map((p) => {
    const quote = latest.get(p.ticker);
    const cost = p.quantity * p.averageCost;
    const value = quote ? p.quantity * quote.close : null;
    return {
      ...p,
      cost,
      value,
      price: quote?.close ?? null,
      date: quote?.date ?? null,
      pnl: value === null ? null : value - cost,
    };
  });
  const priced = rows.filter((r) => r.value !== null),
    total = priced.reduce((s, r) => s + r.value!, 0),
    cost = priced.reduce((s, r) => s + r.cost, 0);
  const sectors = new Map<string, number>();
  for (const r of priced)
    sectors.set(r.sector, (sectors.get(r.sector) ?? 0) + r.value!);
  return {
    rows: rows.map((r) => ({
      ...r,
      weight: r.value === null || !total ? null : r.value / total,
    })),
    total,
    cost,
    pnl: total - cost,
    returnOnCost: cost > 0 ? (total - cost) / cost : null,
    missing: rows.length - priced.length,
    sectors: [...sectors].map(([name, value]) => ({ name, value })),
    dates: [...new Set(priced.map((r) => r.date!))].sort(),
  };
}
export function sectorOverview(universe: Instrument[]) {
  const sectors = new Map<string, Instrument[]>();
  for (const c of universe)
    sectors.set(c.sector, [...(sectors.get(c.sector) ?? []), c]);
  return [...sectors]
    .map(([name, companies]) => {
      const pe = companies
        .map((c) => c.pe)
        .filter((p): p is number => p !== null && p > 0)
        .sort((a, b) => a - b);
      return {
        name,
        count: companies.length,
        cap: companies.reduce((s, c) => s + (c.marketCap ?? 0), 0),
        medianPe: pe.length
          ? (pe[Math.floor((pe.length - 1) / 2)] +
              pe[Math.ceil((pe.length - 1) / 2)]) /
            2
          : null,
        peCount: pe.length,
      };
    })
    .sort((a, b) => b.cap - a.cap);
}

import { describe, it, expect } from "vitest";
import { dcf, reverseDcf, allocate, technicals } from "../src/lib/finance";
import { getModel, universe, coverage, getCompany } from "../src/lib/data";
import { screen, eligibility, scoreCompany } from "../src/lib/screening";
const a = getModel("ADBE")!;
describe("Financial invariants", () => {
  it("matches independent flat perpetuity benchmark", () => {
    const flat = {
      ...a,
      revenue: 1000,
      growth: 0,
      margin: 0.2,
      taxRate: 0.25,
      daRate: 0,
      capexRate: 0,
      nwcRate: 0,
      wacc: 0.1,
      terminalGrowth: 0,
      shares: 10,
      netDebt: 100,
    };
    expect(dcf(flat).fairValue).toBeCloseTo((150 / 0.1 - 100) / 10, 9);
  });
  it("year-six reinvestment follows terminal growth", () => {
    const r = dcf(a);
    const rev = r.years[4].revenue;
    expect(r.fcff6).toBeCloseTo(
      rev *
        (1 + a.terminalGrowth) *
        (a.margin * (1 - a.taxRate) + a.daRate - a.capexRate) -
        rev * a.terminalGrowth * a.nwcRate,
      8,
    );
  });
  it("reverse DCF recovers growth", () =>
    expect(reverseDcf(a, dcf(a).fairValue)).toBeCloseTo(a.growth, 7));
  it("rejects terminal growth at WACC", () =>
    expect(() => dcf({ ...a, terminalGrowth: 0.04, wacc: 0.04 })).toThrow());
  it("rejects zero shares", () =>
    expect(() => dcf({ ...a, shares: 0 })).toThrow());
  it("rejects unsupported currency", () =>
    expect(() => dcf({ ...a, currency: "EUR" as "USD" })).toThrow());
  it("rejects negative normalized FCFF", () =>
    expect(() => dcf({ ...a, capexRate: 0.5 })).toThrow());
  it("reverse handles out-of-range and missing price", () => {
    expect(reverseDcf(a, 1e9)).toBeNull();
    expect(reverseDcf(a, 0)).toBeNull();
  });
  it("WACC increase lowers value", () =>
    expect(dcf({ ...a, wacc: a.wacc + 0.01 }).fairValue).toBeLessThan(
      dcf(a).fairValue,
    ));
  it("12m target uses EV roll-forward minus FCFF and fixed net debt", () => {
    const r = dcf(a);
    expect(r.target12m).toBeCloseTo(
      (r.ev * (1 + a.wacc) - r.years[0].fcff - a.netDebt) / a.shares,
      10,
    );
  });
  it("allocates exact dollars including rounding cents", () => {
    expect(
      allocate([3333, 3333, 3334], 100000.01).reduce(
        (s, x) => s + Math.round(x * 100),
        0,
      ),
    ).toBe(10000001);
    expect(allocate([4000, 3500, 2500])).toEqual([40000, 35000, 25000]);
  });
  it("rejects incorrect portfolio weights", () =>
    expect(() => allocate([3000, 3000, 3000])).toThrow());
  it("technical data does not invent SMA200", () =>
    expect(technicals([]).sma200).toBeNull());
  it("technical calculations use chronological bars", () => {
    const bars = Array.from({ length: 200 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
      close: i + 1,
      volume: 1000,
    })).reverse();
    expect(technicals(bars).sma200).toBe(100.5);
    expect(technicals(bars).sma50).toBe(175.5);
  });
});
describe("Universal coverage and isolation", () => {
  it("covers actual imported rows", () => {
    expect(coverage().instruments).toBe(503);
    expect(new Set(universe.map((c) => c.ticker)).size).toBe(503);
    expect(coverage().datedPrices).toBe(0);
  });
  it("searches non-focus company", () =>
    expect(screen(universe, { query: "MSFT" }).rows[0].ticker).toBe("MSFT"));
  it("two filters change real results", () => {
    const x = screen(universe, { maxPe: 15, minCap: 1e11 });
    expect(x.total).toBeLessThan(universe.length);
    expect(x.rows.every((c) => c.pe! <= 15 && c.marketCap! >= 1e11)).toBe(true);
  });
  it("pagination does not lose or duplicate records", () => {
    const all = Array.from(
      { length: Math.ceil(universe.length / 100) },
      (_, i) => screen(universe, { page: i + 1, pageSize: 100 }).rows,
    ).flat();
    expect(all.length).toBe(universe.length);
    expect(new Set(all.map((c) => c.ticker)).size).toBe(universe.length);
  });
  it("missing date blocks contest but not universal research", () => {
    const n = screen(universe).total;
    expect(
      eligibility(getCompany("ADBE")!).some((g) => g.status === "REVIEW"),
    ).toBe(true);
    expect(screen(universe).total).toBe(n);
  });
  it("does not assign fallback score to missing data", () =>
    expect(
      scoreCompany({ ...universe[0], pe: null }, universe).score,
    ).toBeNull());
  it("no validated dated quotes are claimed", () =>
    expect(screen(universe, { datedOnly: true }).total).toBe(0));
});
describe("Scenario robustness", () => {
  it("does not crash when a derived scenario has non-positive FCFF", async () => {
    const { scenarios } = await import("../src/lib/finance");
    const result = scenarios({
      ...a,
      growth: 0,
      margin: 0.2,
      taxRate: 0.2,
      daRate: 0,
      capexRate: 0.15,
      nwcRate: 0,
    });
    expect(result[0].fairValue).toBeNull();
    expect(result[1].fairValue).not.toBeNull();
  });
});

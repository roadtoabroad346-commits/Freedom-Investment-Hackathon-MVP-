import { describe, it, expect } from "vitest";
import { parseCsv, validateFacts, validatePrices } from "../src/lib/imports";
describe("Point-in-time imports", () => {
  const price = {
    ticker: "MSFT",
    date: "2026-10-28",
    close: 400,
    volume: 100,
    sourceUrl: "https://example.com/licensed-export",
  };
  it("rejects future prices", () =>
    expect(() => validatePrices([price], "2026-10-27")).toThrow("look-ahead"));
  it("rejects duplicate dates", () =>
    expect(() => validatePrices([price, price], "2026-10-28")).toThrow(
      "Дубли",
    ));
  it("rejects impossible dates and negative volume", () => {
    expect(() =>
      validatePrices([{ ...price, date: "2026-02-30" }], "2026-10-28"),
    ).toThrow();
    expect(() =>
      validatePrices([{ ...price, volume: -1 }], "2026-10-28"),
    ).toThrow();
  });
  it("accepts valid source and date", () =>
    expect(validatePrices([price], "2026-10-28")).toHaveLength(1));
  it("does not turn empty CSV values into zero", () =>
    expect((parseCsv("a,b\n,2\n")[0] as { a: null }).a).toBeNull());
  it("rejects reports filed after cutoff", () =>
    expect(() =>
      validateFacts(
        [
          {
            ticker: "MSFT",
            periodEnd: "2025-12-31",
            filedAt: "2026-02-01",
            revenue: 100,
            priorRevenue: 90,
            operatingIncome: 10,
            dilutedShares: 10,
            cash: 1,
            debt: 2,
            taxRate: 0.2,
            sourceUrl: "https://example.com/filing",
          },
        ],
        "2026-01-31",
      ),
    ).toThrow("look-ahead"));
});

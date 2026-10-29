import raw from "../../data/universe.json";
import annual from "../../data/annual-facts.json";
import provenance from "../../data/provenance.json";
import { focusResearch } from "./research";
import type { Instrument, AnnualFact, Assumptions } from "./types";
export const universe = raw as Instrument[];
export const annualFacts = annual as Record<string, AnnualFact>;
export { provenance };
export function getCompany(ticker: string) {
  return universe.find((c) => c.ticker === ticker.toUpperCase());
}
export function getModel(
  ticker: string,
  instruments: Instrument[] = universe,
  facts: Record<string, AnnualFact> = annualFacts,
): Assumptions | null {
  const fact = facts[ticker],
    research = focusResearch.find((r) => r.ticker === ticker),
    company = instruments.find((c) => c.ticker === ticker);
  if (
    !fact ||
    fact.operatingIncome <= 0 ||
    /bank|insurance|mortgage|reit|capital markets/i.test(company?.sector ?? "")
  )
    return null;
  const assumptions = research?.assumptions ?? {
    growth: Math.max(
      -0.05,
      Math.min(0.15, fact.revenue / fact.priorRevenue - 1),
    ),
    margin: fact.operatingIncome / fact.revenue,
    taxRate: fact.taxRate,
    daRate: 0.02,
    capexRate: 0.03,
    nwcRate: 0.1,
    wacc: 0.1,
    terminalGrowth: 0.02,
  };
  return {
    ...assumptions,
    revenue: fact.revenue,
    shares: fact.dilutedShares,
    netDebt: fact.debt - fact.cash,
    currency: "USD",
  };
}
export function coverage() {
  return {
    instruments: universe.length,
    financialMetrics: universe.filter((c) => c.pe !== null || c.ebitda !== null)
      .length,
    annualStatements: Object.keys(annualFacts).length,
    datedPrices: universe.filter((c) => c.priceAsOf !== null).length,
    undatedQuotes: universe.filter((c) => c.price !== null && !c.priceAsOf)
      .length,
    asOf: provenance.priceAsOf,
    importedAt: provenance.importedAt,
  };
}

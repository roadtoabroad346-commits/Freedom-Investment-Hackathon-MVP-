import { unstable_cache } from "next/cache";
import {
  universe as localUniverse,
  annualFacts as localFacts,
  getModel as baseModel,
  provenance,
} from "./data";
import { snapshot as localSnapshot } from "./snapshot";
import { publicSupabase } from "./supabase/server";
import { cloudConfigured } from "./supabase/config";
import { screen, type ScreenFilters } from "./screening";
import type { Instrument, AnnualFact, Snapshot } from "./types";
function dataset(
  instruments: Instrument[],
  facts: Record<string, AnnualFact>,
  storage: "supabase" | "local",
) {
  const getCompany = (ticker: string) =>
    instruments.find((c) => c.ticker === ticker.toUpperCase());
  return {
    universe: instruments,
    annualFacts: facts,
    storage,
    getCompany,
    getModel: (ticker: string) => baseModel(ticker, instruments, facts),
    coverage: () => ({
      instruments: instruments.length,
      financialMetrics: instruments.filter(
        (c) => c.pe !== null || c.ebitda !== null,
      ).length,
      annualStatements: Object.keys(facts).length,
      datedPrices: instruments.filter((c) => c.priceAsOf !== null).length,
      undatedQuotes: instruments.filter((c) => c.price !== null && !c.priceAsOf)
        .length,
      asOf: provenance.priceAsOf,
      importedAt: provenance.importedAt,
    }),
  };
}
export type ResearchDataset = ReturnType<typeof dataset>;
export const localDataset = dataset(localUniverse, localFacts, "local");
const loadCloud = unstable_cache(
  async () => {
    const client = publicSupabase();
    const instruments: Instrument[] = [];
    for (let page = 0; page < 10; page++) {
      const { data, error } = await client
        .from("mx_instruments")
        .select("payload")
        .order("ticker")
        .range(page * 1000, page * 1000 + 999);
      if (error) throw new Error("Не удалось прочитать компании из Supabase");
      instruments.push(...data.map((row) => row.payload as Instrument));
      if (data.length < 1000) break;
      if (page === 9)
        throw new Error("Нужен более широкий пакет загрузки universe");
    }
    if (!instruments.length)
      throw new Error("В Supabase ещё не загружены компании");
    const facts: Record<string, AnnualFact> = {};
    for (let page = 0; page < 10; page++) {
      const { data, error } = await client
        .from("mx_annual_facts")
        .select("ticker,payload")
        .order("ticker")
        .range(page * 1000, page * 1000 + 999);
      if (error) throw new Error("Не удалось прочитать факты из Supabase");
      for (const row of data) facts[row.ticker] = row.payload;
      if (data.length < 1000) break;
    }
    return { instruments, facts };
  },
  ["mirror-x-reference-v1"],
  { revalidate: 120 },
);
export async function getDataset(): Promise<ResearchDataset> {
  if (!cloudConfigured()) return localDataset;
  const { instruments, facts } = await loadCloud();
  return dataset(instruments, facts, "supabase");
}
export async function getPublishedSnapshot(): Promise<Snapshot> {
  if (!cloudConfigured()) return localSnapshot;
  const { data, error } = await publicSupabase()
    .from("mx_snapshots")
    .select("payload")
    .eq("id", localSnapshot.id)
    .single();
  if (error || !data) throw new Error("Опубликованный snapshot недоступен");
  return data.payload as Snapshot;
}
export function safeSearch(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s.\-]/gu, " ")
    .slice(0, 80)
    .trim();
}
export async function screenRepository(f: ScreenFilters = {}) {
  if (!cloudConfigured()) return screen(localUniverse, f);
  const page = Math.max(1, f.page ?? 1),
    pageSize = Math.min(100, Math.max(1, f.pageSize ?? 25));
  let q = publicSupabase()
    .from("mx_instruments")
    .select("payload,score,score_details", { count: "exact" });
  const term = safeSearch(f.query ?? "");
  if (term) q = q.or(`ticker.ilike.%${term}%,name.ilike.%${term}%`);
  if (f.sector) q = q.eq("sector", f.sector);
  if (f.maxPe !== undefined) q = q.gt("pe", 0).lte("pe", f.maxPe);
  if (f.minCap !== undefined) q = q.gte("market_cap", f.minCap);
  if (f.positiveEbitda) q = q.gt("ebitda", 0);
  if (f.datedOnly) q = q.not("price_asof", "is", null);
  if (f.sort === "score")
    q = q.order("score", { ascending: false, nullsFirst: false });
  else if (f.sort === "cap")
    q = q.order("market_cap", { ascending: false, nullsFirst: false });
  else if (f.sort === "pe")
    q = q.order("positive_pe", { ascending: true, nullsFirst: false });
  q = q.order("ticker").range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw new Error("Не удалось выполнить запрос скринера");
  return {
    total: count ?? 0,
    page,
    pageSize,
    rows: (data ?? []).map((row) => ({
      ...(row.payload as Instrument),
      ...row.score_details,
      score: row.score,
    })),
  };
}

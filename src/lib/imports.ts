import { z } from "zod";
import { parse } from "csv-parse/sync";
const finite = z.number().finite(),
  positive = finite.positive(),
  nullable = finite.nullable();
const date = z.iso.date();
const url = z
  .url()
  .refine((s) => s.startsWith("https://"), "Нужен источник HTTPS");
export const instrumentSchema = z.object({
  ticker: z.string().regex(/^[A-Z0-9][A-Z0-9.\-]{0,11}$/),
  name: z.string().min(1).max(200),
  sector: z.string().min(1).max(100),
  exchange: z.enum(["NYSE", "NASDAQ"]).nullable(),
  assetType: z.enum(["COMMON", "ADR", "UNKNOWN"]),
  price: positive.nullable(),
  priceAsOf: date.nullable(),
  marketCap: positive.nullable(),
  pe: nullable,
  ebitda: nullable,
  priceSales: nullable,
  priceBook: nullable,
  sourceUrl: url,
  quality: z.enum(["PROVISIONAL", "UNDATED", "STALE", "MISSING"]),
  avgDollarVolume: finite.nonnegative().nullable(),
  historyYears: finite.nonnegative().nullable(),
  restrictedRevenueShare: finite.min(0).max(1).nullable(),
});
export const factSchema = z
  .object({
    ticker: z.string().regex(/^[A-Z0-9][A-Z0-9.\-]{0,11}$/),
    periodEnd: date,
    filedAt: date,
    revenue: positive,
    priorRevenue: positive,
    operatingIncome: finite,
    dilutedShares: positive,
    cash: finite.nonnegative(),
    debt: finite.nonnegative(),
    taxRate: finite.min(0).max(0.6),
    sourceUrl: url,
  })
  .refine((f) => f.filedAt >= f.periodEnd, {
    message: "Отчёт не может быть опубликован до окончания периода",
  });
export const priceSchema = z.object({
  ticker: z.string().regex(/^[A-Z0-9][A-Z0-9.\-]{0,11}$/),
  date,
  close: positive,
  volume: finite.nonnegative().int(),
  sourceUrl: url,
});
export type PriceBar = z.infer<typeof priceSchema>;
export function parseCsv(text: string) {
  if (Buffer.byteLength(text) > 10_000_000) throw new Error("Лимит CSV 10 MB");
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    cast: (value, context) =>
      context.header
        ? value
        : value === ""
          ? null
          : /^-?\d+(\.\d+)?$/.test(value)
            ? Number(value)
            : value,
  }) as unknown[];
  if (rows.length > 10000) throw new Error("Максимум 10000 строк на пакет");
  return rows;
}
export function validatePrices(rows: unknown[], cutoff: string) {
  date.parse(cutoff);
  const prices = rows.map((p) => priceSchema.parse(p));
  if (prices.some((p) => p.date > cutoff))
    throw new Error("Цена позже cutoff: look-ahead запрещён");
  if (
    new Set(prices.map((p) => p.ticker + "|" + p.date)).size !== prices.length
  )
    throw new Error("Дубли ticker/date");
  return prices;
}
export function validateFacts(rows: unknown[], cutoff: string) {
  date.parse(cutoff);
  const facts = rows.map((p) => factSchema.parse(p));
  if (facts.some((f) => f.filedAt > cutoff))
    throw new Error("Отчёт опубликован после cutoff: look-ahead запрещён");
  if (new Set(facts.map((p) => p.ticker)).size !== facts.length)
    throw new Error("Один факт-срез на тикер в пакете");
  return facts;
}

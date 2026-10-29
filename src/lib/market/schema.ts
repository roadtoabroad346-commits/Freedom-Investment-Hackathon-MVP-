import { z } from "zod";
const ticker = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9.\-]{0,11}$/);
const price = z.number().finite().positive().max(1e9);
export const barSchema = z
  .object({
    ticker,
    date: z.iso.date(),
    open: price.nullable(),
    high: price.nullable(),
    low: price.nullable(),
    close: price,
    volume: z.number().finite().int().nonnegative().max(1e15).nullable(),
  })
  .strict()
  .superRefine((b, ctx) => {
    const ohl = [b.open, b.high, b.low];
    if (ohl.some((v) => v !== null) && ohl.some((v) => v === null))
      ctx.addIssue({
        code: "custom",
        message: "open, high и low нужны вместе",
      });
    if (
      b.high !== null &&
      b.low !== null &&
      b.open !== null &&
      (b.high < Math.max(b.open, b.close, b.low) ||
        b.low > Math.min(b.open, b.close))
    )
      ctx.addIssue({ code: "custom", message: "Нарушен диапазон OHLC" });
  });
export const positionSchema = z
  .object({
    ticker,
    quantity: z.number().finite().positive().max(1e12),
    averageCost: z.number().finite().nonnegative().max(1e9),
    sector: z.string().trim().max(100).default("Не указан"),
  })
  .strict();
export const businessFactSchema = z
  .object({
    ticker,
    periodEnd: z.iso.date(),
    revenue: z.number().finite().positive().max(1e15),
    operatingIncome: z.number().finite().min(-1e15).max(1e15),
    cash: z.number().finite().nonnegative().max(1e15),
    debt: z.number().finite().nonnegative().max(1e15),
    source: z.string().trim().min(1).max(300),
  })
  .strict();
export type BusinessFact = z.infer<typeof businessFactSchema>;
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(100),
    currency: z.literal("USD"),
    source: z.string().trim().min(1).max(300),
    priceBasis: z.enum(["adjusted", "unadjusted", "unknown"]),
    bars: z.array(barSchema).max(5000),
    positions: z.array(positionSchema).max(200),
    financials: z.array(businessFactSchema).max(200).default([]),
  })
  .strict()
  .superRefine((w, ctx) => {
    if (
      new Set(w.financials.map((f) => f.ticker + "|" + f.periodEnd)).size !==
      w.financials.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Повтор ticker/periodEnd в Financials",
      });
    if (
      new Set(w.bars.map((b) => `${b.ticker}|${b.date}`)).size !== w.bars.length
    )
      ctx.addIssue({ code: "custom", message: "Повтор ticker/date" });
    if (new Set(w.positions.map((p) => p.ticker)).size !== w.positions.length)
      ctx.addIssue({
        code: "custom",
        message:
          "Повтор позиции: объедините лоты по средневзвешенной стоимости",
      });
    if (new Set(w.bars.map((b) => b.ticker)).size > 30)
      ctx.addIssue({ code: "custom", message: "Не более 30 тикеров истории" });
  });
export type MarketBar = z.infer<typeof barSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export const emptyWorkspace: Workspace = {
  version: 1,
  name: "Мой портфель",
  currency: "USD",
  source: "Мои файлы",
  priceBasis: "unknown",
  bars: [],
  positions: [],
  financials: [],
};
export function validateWorkspace(
  value: unknown,
  today = new Date().toISOString().slice(0, 10),
): Workspace {
  const result = workspaceSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      result.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  if (result.data.bars.some((b) => b.date > today || b.date < "1900-01-01"))
    throw new Error("Дата котировки вне диапазона 1900-01-01 — сегодня");
  if (
    result.data.financials.some(
      (f) => f.periodEnd > today || f.periodEnd < "1900-01-01",
    )
  )
    throw new Error("Дата финансового периода вне допустимого диапазона");
  return {
    ...result.data,
    financials: [...result.data.financials].sort(
      (a, b) =>
        a.ticker.localeCompare(b.ticker) ||
        a.periodEnd.localeCompare(b.periodEnd),
    ),
    bars: [...result.data.bars].sort(
      (a, b) =>
        a.ticker.localeCompare(b.ticker) || a.date.localeCompare(b.date),
    ),
  };
}

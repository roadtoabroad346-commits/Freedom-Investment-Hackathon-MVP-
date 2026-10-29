import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  parseCsv,
  validatePrices,
  validateFacts,
  instrumentSchema,
} from "../src/lib/imports";
import type { Instrument, AnnualFact } from "../src/lib/types";
const [kind, file, cutoff] = process.argv.slice(2);
if (!["instruments", "prices", "facts"].includes(kind) || !file || !cutoff)
  throw new Error(
    "Использование: npm run import -- instruments|prices|facts <file.csv> <YYYY-MM-DD cutoff>",
  );
if (cutoff > new Date().toISOString().slice(0, 10))
  throw new Error("Будущий cutoff запрещён");
const input = await readFile(file, "utf8"),
  rows = parseCsv(input);
const instruments = JSON.parse(
  await readFile("data/universe.json", "utf8"),
) as Instrument[];
let imported = 0;
if (kind === "instruments") {
  const result = rows.map((p) => instrumentSchema.parse(p));
  if (new Set(result.map((c) => c.ticker)).size !== result.length)
    throw new Error("Повторяющиеся тикеры");
  if (result.some((c) => c.priceAsOf && c.priceAsOf > cutoff))
    throw new Error("Будущая цена");
  for (const c of result) {
    const n = instruments.findIndex((x) => x.ticker === c.ticker);
    if (n < 0) instruments.push(c);
    else instruments[n] = c;
  }
  await writeFile("data/universe.json", JSON.stringify(instruments, null, 2));
  imported = result.length;
}
if (kind === "facts") {
  const result = validateFacts(rows, cutoff),
    facts = JSON.parse(
      await readFile("data/annual-facts.json", "utf8"),
    ) as Record<string, AnnualFact>;
  for (const { ticker, ...f } of result) {
    if (!instruments.some((i) => i.ticker === ticker))
      throw new Error(`Сначала импортируйте инструмент ${ticker}`);
    facts[ticker] = {
      ...f,
      history: [
        {
          year: f.periodEnd.slice(0, 4),
          revenue: f.revenue,
          operatingIncome: f.operatingIncome,
        },
      ],
    };
  }
  await writeFile("data/annual-facts.json", JSON.stringify(facts, null, 2));
  imported = result.length;
}
if (kind === "prices") {
  const result = validatePrices(rows, cutoff);
  for (const p of result)
    if (!instruments.some((i) => i.ticker === p.ticker))
      throw new Error(`Неизвестный тикер ${p.ticker}`);
  await mkdir("data/price-imports", { recursive: true });
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 16);
  await writeFile(
    `data/price-imports/${hash}.json`,
    JSON.stringify(result, null, 2),
  );
  const latest = new Map<string, (typeof result)[number]>();
  for (const p of result)
    if (!latest.has(p.ticker) || latest.get(p.ticker)!.date < p.date)
      latest.set(p.ticker, p);
  for (const c of instruments) {
    const p = latest.get(c.ticker);
    if (p) {
      c.price = p.close;
      c.priceAsOf = p.date;
      c.sourceUrl = p.sourceUrl;
      c.quality = "PROVISIONAL"; // Do not reuse an undated market cap after updating price.
      c.marketCap = null;
      c.avgDollarVolume = null;
    }
  }
  await writeFile("data/universe.json", JSON.stringify(instruments, null, 2));
  imported = result.length;
}
const coverage = JSON.parse(await readFile("data/provenance.json", "utf8"));
coverage.rows = instruments.length;
coverage.lastUserImport = {
  kind,
  cutoff,
  rows: imported,
  sha256: createHash("sha256").update(input).digest("hex"),
  importedAt: new Date().toISOString(),
};
await writeFile("data/provenance.json", JSON.stringify(coverage, null, 2));
console.log(
  `Imported ${imported} ${kind}. Review sources and run npm run snapshot && npm run exports && npm run check. No FINAL status is automatically granted.`,
);

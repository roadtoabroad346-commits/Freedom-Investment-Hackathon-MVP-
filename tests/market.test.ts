import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { readFile, writeFile } from "node:fs/promises";
import {
  validateWorkspace,
  emptyWorkspace,
  type MarketBar,
  type Workspace,
} from "../src/lib/market/schema";
import {
  seriesMetrics,
  portfolioMetrics,
  alignedComparison,
  sectorOverview,
} from "../src/lib/market/analytics";
import {
  readSpreadsheet,
  workbook,
  pricesCsv,
  marketWorkbook,
} from "../src/lib/market/spreadsheets";
import { mergeWorkspaces } from "../src/lib/market/merge";
const bar = (ticker: string, date: string, close: number): MarketBar => ({
  ticker,
  date,
  close,
  open: null,
  high: null,
  low: null,
  volume: null,
});
const sample: Workspace = {
  ...emptyWorkspace,
  source: "Synthetic test fixture — not market data",
  bars: [
    bar("TESTA", "2026-01-01", 100),
    bar("TESTA", "2026-01-02", 120),
    bar("TESTA", "2026-01-03", 90),
    bar("TESTB", "2026-01-02", 40),
    bar("TESTB", "2026-01-03", 44),
  ],
  positions: [
    { ticker: "TESTA", quantity: 2, averageCost: 80, sector: "Test" },
    { ticker: "TESTB", quantity: 1, averageCost: 50, sector: "Test" },
    { ticker: "MISSING", quantity: 3, averageCost: 10, sector: "Other" },
  ],
};
describe("Market math with independently known results", () => {
  it("price return, peak drawdown and sample volatility reflect observations", () => {
    const m = seriesMetrics(sample.bars.filter((b) => b.ticker === "TESTA"));
    expect(m.change).toBeCloseTo(-0.1);
    expect(m.maxDrawdown).toBeCloseTo(-0.25);
    expect(m.volatility).toBeCloseTo(Math.sqrt(0.225 ** 2 + 0.225 ** 2));
    expect(m.points[1].normalized).toBe(120);
    expect(m.points[2].sma20).toBeNull();
  });
  it("aligns comparison dates before choosing base and never forward fills", () => {
    const rows = alignedComparison(sample.bars, ["TESTA", "TESTB"]);
    expect(rows.map((r) => r.date)).toEqual(["2026-01-02", "2026-01-03"]);
    expect(rows[0].TESTA).toBe(100);
    expect(rows[1].TESTA).toBe(75);
    expect(rows[1].TESTB).toBeCloseTo(110);
    expect(alignedComparison(sample.bars, ["TESTA", "MISSING"])).toEqual([]);
  });
  it("portfolio excludes unpriced positions from denominators and tracks mixed dates", () => {
    const p = portfolioMetrics(sample);
    expect(p.total).toBe(224);
    expect(p.cost).toBe(210);
    expect(p.pnl).toBe(14);
    expect(p.missing).toBe(1);
    expect(p.rows[0].weight).toBeCloseTo(180 / 224);
    expect(p.rows[2].weight).toBeNull();
    expect(p.returnOnCost).toBeCloseTo(14 / 210);
  });
  it("single point has no return, drawdown or volatility and supports zero costs", () => {
    const m = seriesMetrics([bar("X", "2026-01-01", 4)]);
    expect(m.change).toBeNull();
    expect(m.maxDrawdown).toBeNull();
    expect(m.volatility).toBeNull();
    expect(
      portfolioMetrics({
        ...sample,
        positions: [
          { ticker: "TESTA", quantity: 1, averageCost: 0, sector: "Test" },
        ],
      }).returnOnCost,
    ).toBeNull();
  });
});
describe("Spreadsheet trust boundary", () => {
  it("accepts Russian semicolon CSV with decimal comma and closing-only prices", async () => {
    const w = await readSpreadsheet(
      Buffer.from('Тикер;Дата;Закрытие\nTESTA;2026-01-01;"10,5"'),
      "a.csv",
      "Test",
      "unknown",
    );
    expect(w.bars[0].close).toBe(10.5);
    expect(w.bars[0].volume).toBeNull();
  });
  it("rejects formula cells with an actionable row issue", async () => {
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet("Prices");
    s.addRow(["ticker", "date", "close"]);
    s.addRow(["TESTA", "2026-01-01", { formula: "1+1", result: 2 }]);
    await expect(
      readSpreadsheet(
        Buffer.from(await wb.xlsx.writeBuffer()),
        "test.xlsx",
        "Test",
        "unknown",
      ),
    ).rejects.toMatchObject({
      issues: [
        {
          sheet: "Prices",
          row: 2,
          message: "Нужны значения, без формул/ссылок",
        },
      ],
    });
  });
  it("rejects duplicate, future, invalid date, invalid OHLC and incomplete OHLC", () => {
    for (const bars of [
      [sample.bars[0], sample.bars[0]],
      [bar("A", "2099-01-01", 1)],
      [bar("A", "2026-02-30", 1)],
      [{ ...sample.bars[0], open: 100, high: 80, low: 50 }],
      [{ ...sample.bars[0], open: 100 }],
    ])
      expect(() => validateWorkspace({ ...emptyWorkspace, bars })).toThrow();
  });
  it("rejects negative volume, short positions, NaN and unknown currency", () => {
    expect(() =>
      validateWorkspace({
        ...sample,
        bars: [{ ...sample.bars[0], volume: -1 }],
      }),
    ).toThrow();
    expect(() =>
      validateWorkspace({
        ...sample,
        positions: [{ ...sample.positions[0], quantity: -1 }],
      }),
    ).toThrow();
    expect(() =>
      validateWorkspace({
        ...sample,
        bars: [{ ...sample.bars[0], close: NaN }],
      }),
    ).toThrow();
    expect(() => validateWorkspace({ ...sample, currency: "EUR" })).toThrow();
  });
  it("does not silently overwrite duplicate histories or differing sources", () => {
    expect(() => mergeWorkspaces(sample, sample)).toThrow();
    expect(() =>
      mergeWorkspaces(sample, { ...sample, source: "Other" }),
    ).toThrow();
  });
  it("rejects macros/external relations and expanded archive limits", async () => {
    const zip = new JSZip();
    zip.file("xl/externalLinks/externalLink1.xml", "x");
    await expect(
      readSpreadsheet(
        await zip.generateAsync({ type: "nodebuffer" }),
        "evil.xlsx",
        "Test",
        "unknown",
      ),
    ).rejects.toThrow("XLSX");
    const large = new JSZip();
    large.file("big.xml", "a".repeat(12_000_001));
    await expect(
      readSpreadsheet(
        await large.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
        }),
        "big.xlsx",
        "Test",
        "unknown",
      ),
    ).rejects.toThrow("XLSX");
  });
  it("rejects files above the request limit and unknown headers", async () => {
    await expect(
      readSpreadsheet(Buffer.alloc(4_000_001), "big.csv", "Test", "unknown"),
    ).rejects.toThrow("4 MB");
    await expect(
      readSpreadsheet(Buffer.from("a,b\n1,2"), "a.csv", "Test", "unknown"),
    ).rejects.toThrow("заголовками");
  });
  it("XLSX round-trip retains raw rows and real Excel chart relations", async () => {
    const b = await workbook(validateWorkspace(sample));
    const back = await readSpreadsheet(
      b,
      "workspace.xlsx",
      sample.source,
      "unknown",
    );
    expect(back.bars).toEqual(validateWorkspace(sample).bars);
    expect(back.positions).toEqual(sample.positions);
    const zip = await JSZip.loadAsync(b);
    expect(await zip.file("xl/charts/chart1.xml")!.async("string")).toContain(
      "'Prices'!$F$2:$F$4",
    );
    expect(
      await zip.file("xl/worksheets/sheet1.xml")!.async("string"),
    ).toContain("<drawing xmlns:r=");
    if (process.env.VISUAL_EXPORT_EVIDENCE_PATH)
      await writeFile(process.env.VISUAL_EXPORT_EVIDENCE_PATH, b);
  });
  it("CSV round-trip retains prices and quotes values safely", async () => {
    const b = await readSpreadsheet(
      Buffer.from(pricesCsv(sample)),
      "out.csv",
      sample.source,
      "unknown",
    );
    expect(b.bars).toEqual(validateWorkspace(sample).bars);
  });
  it("empty XLSX template includes usable headers without invented observations", async () => {
    const b = await workbook(emptyWorkspace, true);
    const back = await readSpreadsheet(b, "template.xlsx", "Test", "unknown");
    expect(back.bars).toHaveLength(0);
    expect(back.positions).toHaveLength(0);
  });
});

describe("Business financial imports", () => {
  it("round-trips business periods including operating losses", async () => {
    const financials = [
      {
        ticker: "MYCO",
        periodEnd: "2025-12-31",
        revenue: 100000,
        operatingIncome: -1000,
        cash: 20000,
        debt: 5000,
        source: "Private accounting fixture",
      },
    ];
    const b = await workbook({ ...emptyWorkspace, financials });
    const back = await readSpreadsheet(
      b,
      "company.xlsx",
      "Accounting",
      "unknown",
    );
    expect(back.financials).toEqual(financials);
    const zip = await JSZip.loadAsync(b);
    expect(await zip.file("xl/charts/chart1.xml")!.async("string")).toContain(
      "'Financials'!$C$2:$C$2",
    );
    if (process.env.VISUAL_EXPORT_EVIDENCE_PATH)
      await writeFile(
        process.env.VISUAL_EXPORT_EVIDENCE_PATH + ".business.xlsx",
        b,
      );
    expect(back.bars).toHaveLength(0);
  });
  it("does not retain any previous user's imported rows between requests", async () => {
    await readSpreadsheet(
      Buffer.from("ticker,date,close\nTESTA,2026-01-01,42"),
      "a.csv",
      "A",
      "unknown",
    );
    const second = await readSpreadsheet(
      Buffer.from("ticker,date,close\nTESTB,2026-01-01,51"),
      "b.csv",
      "B",
      "unknown",
    );
    expect(second.bars.map((b) => b.ticker)).toEqual(["TESTB"]);
    expect(emptyWorkspace.bars).toEqual([]);
  });
});

it("rejects explicit non-USD rows and CSV row limits", async () => {
  await expect(
    readSpreadsheet(
      Buffer.from("ticker,date,close,currency\nTESTA,2026-01-01,42,EUR"),
      "eur.csv",
      "Test",
      "unknown",
    ),
  ).rejects.toMatchObject({
    issues: [{ row: 2, message: expect.stringContaining("USD") }],
  });
  await expect(
    readSpreadsheet(
      Buffer.from("ticker,date,close\n" + "TESTA,2026-01-01,42\n".repeat(5001)),
      "big.csv",
      "Test",
      "unknown",
    ),
  ).rejects.toThrow();
});

it("public Excel reference retains every real imported row and separates undated prices", async () => {
  const universe = JSON.parse(await readFile("data/universe.json", "utf8"));
  const data = await marketWorkbook(universe);
  const zip = await JSZip.loadAsync(data);
  const chart = await zip.file("xl/charts/chart1.xml")!.async("string");
  expect(chart).toContain("'Industries'!$B$2:$B$13");
  expect(chart).toContain("'Industries'!$A$2:$A$13");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as Parameters<typeof wb.xlsx.load>[0]);
  expect(wb.getWorksheet("Reference")!.rowCount - 1).toBe(503);
  expect(wb.getWorksheet("Reference")!.getRow(1).values).toContain(
    "undatedPriceUSD",
  );
  expect(wb.getWorksheet("Industries")!.rowCount - 1).toBe(127);
  if (process.env.VISUAL_EXPORT_EVIDENCE_PATH)
    await writeFile(
      process.env.VISUAL_EXPORT_EVIDENCE_PATH + ".market.xlsx",
      data,
    );
});

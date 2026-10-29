import ExcelJS from "exceljs";
import JSZip from "jszip";
import { parse } from "csv-parse/sync";
import {
  validateWorkspace,
  emptyWorkspace,
  barSchema,
  positionSchema,
  businessFactSchema,
  type Workspace,
} from "./schema";
import type { Instrument } from "../types";
import { sectorOverview, portfolioMetrics, seriesMetrics } from "./analytics";
export const FILE_LIMIT = 4_000_000;
export type ImportIssue = { sheet: string; row: number; message: string };
export class SpreadsheetError extends Error {
  constructor(
    message: string,
    public issues: ImportIssue[] = [],
  ) {
    super(message);
  }
}
const aliases: Record<string, string> = {
  тикер: "ticker",
  валюта: "currency",
  symbol: "ticker",
  дата: "date",
  открытие: "open",
  максимум: "high",
  минимум: "low",
  закрытие: "close",
  объем: "volume",
  объём: "volume",
  количество: "quantity",
  "средняя цена": "averageCost",
  averagecost: "averageCost",
  average_cost: "averageCost",
  сектор: "sector",
  periodend: "periodEnd",
  operatingincome: "operatingIncome",
  период: "periodEnd",
  выручка: "revenue",
  "операционная прибыль": "operatingIncome",
  деньги: "cash",
  долг: "debt",
  источник: "source",
};
function header(v: unknown) {
  const h = String(v ?? "")
    .trim()
    .toLowerCase();
  return aliases[h] ?? h;
}
function number(v: unknown, optional = false): number | null {
  if (v === null || v === undefined || v === "") {
    if (optional) return null;
    throw new Error("Отсутствует число");
  }
  if (typeof v !== "number" && typeof v !== "string")
    throw new Error("Нужны значения, без формул/ссылок");
  const n =
    typeof v === "number"
      ? v
      : Number(v.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) throw new Error("Некорректное число");
  return n;
}
function date(v: unknown) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim()))
    throw new Error("Дата должна быть YYYY-MM-DD или датой Excel");
  return v.trim();
}
export async function readSpreadsheet(
  buffer: Buffer,
  filename: string,
  source: string,
  priceBasis: Workspace["priceBasis"],
) {
  if (buffer.length > FILE_LIMIT)
    throw new SpreadsheetError("Максимальный размер файла — 4 MB");
  const sheets: { name: string; rows: unknown[][] }[] = [];
  if (/\.csv$/i.test(filename)) {
    const text = buffer.toString("utf8");
    const first = text.split(/\r?\n/)[0];
    const delimiter = first.includes(";") ? ";" : ",";
    try {
      sheets.push({
        name: "CSV",
        rows: parse(text, {
          bom: true,
          skip_empty_lines: true,
          trim: true,
          delimiter,
          max_record_size: 20000,
          on_record: (record: string[], info: { records: number }) => {
            if (info.records > 5001 || record.length > 40)
              throw new Error("CSV_LIMIT");
            return record;
          },
        }) as unknown[][],
      });
    } catch {
      throw new SpreadsheetError(
        "Не удалось прочитать CSV. Проверьте разделитель и кавычки",
      );
    }
  } else if (/\.xlsx$/i.test(filename)) {
    try {
      const zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
      const entries = Object.values(zip.files);
      let total = 0;
      for (const e of entries) {
        const size =
          (e as unknown as { _data?: { uncompressedSize: number } })._data
            ?.uncompressedSize ?? 0;
        total += size;
        if (size > 12_000_000 || total > 24_000_000 || entries.length > 200)
          throw new Error("archive");
        if (/vbaProject|externalLinks|embeddings|activeX/i.test(e.name))
          throw new Error("active");
      }
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(
        buffer as unknown as Parameters<typeof wb.xlsx.load>[0],
      );
      for (const sheet of wb.worksheets) {
        if (sheet.rowCount > 5001 || sheet.columnCount > 40)
          throw new Error("size");
        const rows: unknown[][] = [];
        sheet.eachRow({ includeEmpty: true }, (row) =>
          rows.push(
            Array.from(
              { length: sheet.columnCount },
              (_, i) => row.getCell(i + 1).value,
            ),
          ),
        );
        sheets.push({ name: sheet.name, rows });
      }
    } catch {
      throw new SpreadsheetError(
        "Некорректный или слишком большой XLSX. Разрешены обычные таблицы без макросов и внешних связей",
      );
    }
  } else throw new SpreadsheetError("Поддерживаются .xlsx и .csv");
  const workspace: Workspace = {
    ...emptyWorkspace,
    bars: [],
    positions: [],
    financials: [],
    name: filename.replace(/\.[^.]+$/, "").slice(0, 100) || "Мои данные",
    source,
    priceBasis,
  };
  const issues: ImportIssue[] = [];
  let recognized = 0;
  for (const sheet of sheets) {
    if (!sheet.rows.length) continue;
    const headers = sheet.rows[0].map(header);
    const isPrices =
      headers.includes("ticker") &&
      headers.includes("date") &&
      headers.includes("close");
    const isPositions =
      headers.includes("ticker") &&
      headers.includes("quantity") &&
      headers.includes("averageCost");
    const isFinancials =
      headers.includes("ticker") &&
      headers.includes("periodEnd") &&
      headers.includes("revenue") &&
      headers.includes("operatingIncome");
    if (!isPrices && !isPositions && !isFinancials) continue;
    recognized++;
    const useful = headers.filter(Boolean);
    if (new Set(useful).size !== useful.length)
      throw new SpreadsheetError("Повторяющиеся заголовки", [
        {
          sheet: sheet.name,
          row: 1,
          message: "Названия столбцов должны быть уникальны",
        },
      ]);
    for (let i = 1; i < sheet.rows.length; i++) {
      const values = sheet.rows[i];
      if (values.every((v) => v === null || v === undefined || v === ""))
        continue;
      try {
        const r = Object.fromEntries(
          headers.map((h, j) => [h, values[j] ?? null]),
        );
        if (
          r.currency !== undefined &&
          r.currency !== null &&
          r.currency !== "" &&
          String(r.currency).trim().toUpperCase() !== "USD"
        )
          throw new Error(
            "Поддерживается только USD. Конвертируйте данные перед импортом.",
          );
        if (typeof r.ticker !== "string")
          throw new Error("Тикер должен быть текстом");
        const ticker = r.ticker.trim().toUpperCase();
        if (isPrices)
          workspace.bars.push(
            barSchema.parse({
              ticker,
              date: date(r.date),
              open: number(r.open, true),
              high: number(r.high, true),
              low: number(r.low, true),
              close: number(r.close)!,
              volume: number(r.volume, true),
            }),
          );
        else if (isPositions)
          workspace.positions.push(
            positionSchema.parse({
              ticker,
              quantity: number(r.quantity)!,
              averageCost: number(r.averageCost)!,
              sector: typeof r.sector === "string" ? r.sector : "Не указан",
            }),
          );
        else
          workspace.financials.push(
            businessFactSchema.parse({
              ticker,
              periodEnd: date(r.periodEnd),
              revenue: number(r.revenue),
              operatingIncome: number(r.operatingIncome),
              cash: number(r.cash),
              debt: number(r.debt),
              source: typeof r.source === "string" ? r.source : source,
            }),
          );
      } catch (e) {
        issues.push({
          sheet: sheet.name,
          row: i + 1,
          message: e instanceof Error ? e.message : "Некорректная строка",
        });
      }
    }
  }
  if (!recognized)
    throw new SpreadsheetError(
      "Нет таблицы с нужными заголовками. Используйте шаблон Prices, Positions или Financials",
    );
  if (issues.length)
    throw new SpreadsheetError(
      "Файл не принят. Исправьте строки и загрузите снова",
      issues.slice(0, 30),
    );
  try {
    return validateWorkspace(workspace);
  } catch (e) {
    throw new SpreadsheetError(
      e instanceof Error ? e.message : "Данные не прошли проверку",
    );
  }
}
const navy = "17253D",
  green = "147D55";
function styleSheet(s: ExcelJS.Worksheet, headers: string[], widths: number[]) {
  s.addRow(headers);
  s.columns.forEach((c, i) => (c.width = widths[i] ?? 20));
  s.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  s.properties.defaultRowHeight = 23;
  s.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: "1:1",
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2,
    },
  };
  s.headerFooter = { oddFooter: "&LMIRROR X · USD&RСтраница &P / &N" };
  s.getRow(1).height = 30;
  s.getRow(1).eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: navy } };
    c.font = { bold: true, color: { argb: "FFFFFF" } };
  });
}
export async function workbook(w: Workspace, template = false) {
  w = validateWorkspace(w);
  const wb = new ExcelJS.Workbook();
  wb.creator = "MIRROR X";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const guide = wb.addWorksheet("Guide");
  styleSheet(guide, ["MIRROR X · Visual workspace", "Описание"], [32, 110]);
  for (const row of [
    [
      "Статус",
      "Личные данные пользователя · не live feed · не конкурсный FINAL",
    ],
    ["Валюта", "USD. Смешанные валюты запрещены: конвертируйте до загрузки."],
    ["Источник", w.source],
    ["Корректировка цен", w.priceBasis],
    [
      "Prices",
      "ticker,date,open,high,low,close,volume. Дата YYYY-MM-DD. open/high/low — вместе или пусто. volume необязателен.",
    ],
    [
      "Positions",
      "ticker,quantity,averageCost,sector. Только длинные позиции; один агрегированный лот на тикер.",
    ],
    [
      "Лимиты",
      "4 MB, 5000 котировок, 30 тикеров, 200 позиций. Формулы не импортируются: вставьте значения.",
    ],
    [
      "Показатели",
      "Price return без дивидендов, комиссий и валютных эффектов. Просадка по наблюдениям. Пропуски не заполняются.",
    ],
    [
      "Шаблон",
      template
        ? "Пустой шаблон: заполните строки под заголовками, не меняя названия столбцов."
        : "Экспорт восстанавливается через импорт. Листы Summary и Analytics справочные и пропускаются.",
    ],
  ])
    guide.addRow(row);
  guide.addRow([
    "Financials",
    "ticker,periodEnd,revenue,operatingIncome,cash,debt,source. Все суммы — в USD, одинаковая длительность периодов. До 200 периодов.",
  ]);
  guide.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  guide.eachRow((r, i) => {
    if (i > 1) r.height = 36;
  });
  const prices = wb.addWorksheet("Prices");
  styleSheet(
    prices,
    ["ticker", "date", "open", "high", "low", "close", "volume"],
    [15, 16, 16, 16, 16, 16, 22],
  );
  for (const b of w.bars)
    prices.addRow([b.ticker, b.date, b.open, b.high, b.low, b.close, b.volume]);
  prices.autoFilter = { from: "A1", to: `G${Math.max(1, prices.rowCount)}` };
  for (const i of [3, 4, 5, 6]) prices.getColumn(i).numFmt = "0.00";
  prices.getColumn(7).numFmt = "#,##0";
  const positions = wb.addWorksheet("Positions");
  styleSheet(
    positions,
    ["ticker", "quantity", "averageCost", "sector"],
    [15, 18, 20, 30],
  );
  for (const p of w.positions)
    positions.addRow([p.ticker, p.quantity, p.averageCost, p.sector]);
  positions.getColumn(2).numFmt = "0.0000";
  positions.getColumn(3).numFmt = "0.00";
  const financials = wb.addWorksheet("Financials");
  styleSheet(
    financials,
    [
      "ticker",
      "periodEnd",
      "revenue",
      "operatingIncome",
      "cash",
      "debt",
      "source",
    ],
    [15, 18, 22, 22, 22, 22, 50],
  );
  for (const f of w.financials)
    financials.addRow([
      f.ticker,
      f.periodEnd,
      f.revenue,
      f.operatingIncome,
      f.cash,
      f.debt,
      f.source,
    ]);
  positions.autoFilter = {
    from: "A1",
    to: `D${Math.max(1, positions.rowCount)}`,
  };
  financials.autoFilter = {
    from: "A1",
    to: `G${Math.max(1, financials.rowCount)}`,
  };
  for (const i of [3, 4, 5, 6]) financials.getColumn(i).numFmt = "#,##0.00";
  const portfolio = portfolioMetrics(w);
  const summary = wb.addWorksheet("Summary");
  styleSheet(
    summary,
    [
      "ticker",
      "Стоимость USD",
      "Себестоимость USD",
      "P/L USD",
      "Вес оценённых",
      "Дата цены",
    ],
    [27, 23, 23, 23, 23, 18],
  );
  portfolio.rows.forEach((r, i) => {
    const n = i + 2;
    summary.addRow([
      r.ticker,
      r.value,
      r.cost,
      r.pnl === null ? null : { formula: `B${n}-C${n}`, result: r.pnl },
      r.weight,
      r.date,
    ]);
  });
  summary.getColumn(5).numFmt = "0.00%";
  for (const i of [2, 3, 4])
    summary.getColumn(i).numFmt = "#,##0.00;[Red]-#,##0.00";
  if (portfolio.rows.length)
    summary.addConditionalFormatting({
      ref: `D2:D${summary.rowCount}`,
      rules: [
        {
          type: "cellIs",
          operator: "lessThan",
          formulae: [0],
          priority: 1,
          style: { font: { color: { argb: "AD3B35" } } },
        },
      ],
    });
  const totalRow = summary.addRow([
    "ИТОГО ОЦЕНЕНО",
    portfolio.total,
    portfolio.cost,
    portfolio.pnl,
  ]);
  totalRow.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EAF5EF" } };
    c.font = { bold: true, color: { argb: green } };
  });
  summary.addRow(["Итог включает только позиции с загруженной ценой"]);
  summary.addRow(["Даты оценки", portfolio.dates.join(" — ")]);
  summary.addRow(["Не оценены", portfolio.missing]);
  const analytics = wb.addWorksheet("Analytics");
  styleSheet(
    analytics,
    [
      "ticker",
      "Первая дата",
      "Последняя дата",
      "Наблюдений",
      "Price return",
      "Max drawdown",
      "Vol / наблюдение",
    ],
    [15, 18, 18, 20, 20, 20, 24],
  );
  for (const t of [...new Set(w.bars.map((b) => b.ticker))]) {
    const m = seriesMetrics(w.bars.filter((b) => b.ticker === t));
    analytics.addRow([
      t,
      m.first?.date,
      m.last?.date,
      m.points.length,
      m.change,
      m.maxDrawdown,
      m.volatility,
    ]);
  }
  for (const i of [5, 6, 7]) analytics.getColumn(i).numFmt = "0.00%";
  for (const s of wb.worksheets)
    s.eachRow((r, i) => {
      if (i > 1) {
        r.eachCell((c) => {
          c.font = { ...c.font, name: "Aptos", size: 11 };
          if (i % 2 === 0)
            c.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "F2F6FA" },
            };
        });
      }
    });
  let data: Buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const ordered = [...w.bars].sort(
    (a, b) => a.ticker.localeCompare(b.ticker) || a.date.localeCompare(b.date),
  );
  const first = ordered[0]?.ticker;
  const series = ordered.filter((b) => b.ticker === first);
  if (series.length >= 2) data = await addLineChart(data, first!, series);
  else if (w.financials.length) {
    const firstBusiness = w.financials[0].ticker;
    const periods = w.financials.filter((f) => f.ticker === firstBusiness);
    data = await addLineChart(
      data,
      firstBusiness,
      periods.map((f) => ({
        ticker: f.ticker,
        date: f.periodEnd,
        close: f.revenue,
        open: null,
        high: null,
        low: null,
        volume: null,
      })),
      { sheet: "Financials", column: "C", title: "Revenue USD", bar: true },
    );
  }
  return data;
}
async function addLineChart(
  buffer: Buffer,
  ticker: string,
  bars: { date: string; close: number }[],
  config: {
    sheet: string;
    column: string;
    title: string;
    bar: boolean;
    categoryColumn?: string;
  } = { sheet: "Prices", column: "F", title: "Close USD", bar: false },
) {
  const zip = await JSZip.loadAsync(buffer);
  const start = 2,
    end = bars.length + 1;
  // Prices are ticker/date sorted, so first ticker is one contiguous range.
  const escape = (v: string | number) =>
    String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const cache = (values: (string | number)[], type: "str" | "num") =>
    `<c:${type}Cache>${type === "num" ? "<c:formatCode>General</c:formatCode>" : ""}<c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${escape(v)}</c:v></c:pt>`).join("")}</c:${type}Cache>`;
  const chart = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:${config.bar ? "barChart" : "lineChart"}>${config.bar ? '<c:barDir val="col"/>' : ""}<c:grouping val="${config.bar ? "clustered" : "standard"}"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${escape(ticker)} · ${escape(config.title)}</c:v></c:tx><c:spPr><a:ln w="25400"><a:solidFill><a:srgbClr val="${green}"/></a:solidFill></a:ln></c:spPr><c:cat><c:strRef><c:f>'${config.sheet}'!$${config.categoryColumn ?? "B"}$${start}:$${config.categoryColumn ?? "B"}$${end}</c:f>${cache(
    bars.map((b) => b.date),
    "str",
  )}</c:strRef></c:cat><c:val><c:numRef><c:f>'${config.sheet}'!$${config.column}$${start}:$${config.column}$${end}</c:f>${cache(
    bars.map((b) => b.close),
    "num",
  )}</c:numRef></c:val>${config.bar ? "" : '<c:smooth val="0"/>'}</c:ser><c:axId val="100"/><c:axId val="200"/></c:${config.bar ? "barChart" : "lineChart"}><c:catAx><c:axId val="100"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="200"/><c:crosses val="autoZero"/><c:auto val="1"/></c:catAx><c:valAx><c:axId val="200"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:numFmt formatCode="0.00" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="100"/><c:crosses val="autoZero"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
  zip.file("xl/charts/chart1.xml", chart);
  zip.file(
    "xl/drawings/drawing1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>15</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>7</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>33</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="${escape(config.title)} ${escape(ticker)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`,
  );
  zip.file(
    "xl/drawings/_rels/drawing1.xml.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`,
  );
  zip.file(
    "xl/worksheets/_rels/sheet1.xml.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
  );
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  zip.file(
    "xl/worksheets/sheet1.xml",
    sheet.replace(
      "</worksheet>",
      `<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></worksheet>`,
    ),
  );
  const ct = await zip.file("[Content_Types].xml")!.async("string");
  zip.file(
    "[Content_Types].xml",
    ct.replace(
      "</Types>",
      `<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    ),
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
export function pricesCsv(w: Workspace) {
  const cell = (s: unknown) => {
    let v = String(s ?? "");
    if (/^[=+@\-\t\r]/.test(v)) v = "'" + v;
    return `"${v.replace(/"/g, '""')}"`;
  };
  return (
    "\ufeff" +
    [
      ["ticker", "date", "open", "high", "low", "close", "volume"],
      ...w.bars.map((b) => [
        b.ticker,
        b.date,
        b.open,
        b.high,
        b.low,
        b.close,
        b.volume,
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}

export async function marketWorkbook(universe: Instrument[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MIRROR X";
  const guide = wb.addWorksheet("Guide");
  styleSheet(
    guide,
    ["MIRROR X · Reference universe", "Данные и ограничения"],
    [32, 100],
  );
  guide.addRow([
    "Статус",
    "UNDATED: дата финансовых метрик и цен не подтверждена. Это справочный набор, не live feed.",
  ]);
  guide.addRow([
    "Источник",
    "https://github.com/datasets/s-and-p-500-companies-financials",
  ]);
  guide.addRow([
    "График",
    "Капитализация 12 крупнейших отраслевых групп, USD. Не доходность и не изменение цен.",
  ]);
  guide.addRow([
    "Права",
    "Лицензия издателя ODC-PDDL-1.0; права upstream Yahoo требуют проверки перед коммерческой публикацией.",
  ]);
  guide.getColumn(2).alignment = { wrapText: true };
  for (let i = 2; i <= 5; i++) guide.getRow(i).height = 42;
  const reference = wb.addWorksheet("Reference");
  styleSheet(
    reference,
    [
      "ticker",
      "name",
      "industry",
      "marketCapUSD",
      "pe",
      "ebitdaUSD",
      "undatedPriceUSD",
      "priceAsOf",
      "quality",
      "sourceUrl",
    ],
    [14, 38, 35, 25, 18, 25, 22, 18, 18, 65],
  );
  for (const c of universe)
    reference.addRow([
      c.ticker,
      c.name,
      c.sector,
      c.marketCap,
      c.pe,
      c.ebitda,
      c.price,
      c.priceAsOf,
      c.quality,
      c.sourceUrl,
    ]);
  reference.autoFilter = { from: "A1", to: `J${reference.rowCount}` };
  for (const i of [4, 5, 6, 7]) reference.getColumn(i).numFmt = "#,##0.00";
  const sectors = sectorOverview(universe);
  const s = wb.addWorksheet("Industries");
  styleSheet(
    s,
    ["industry", "marketCapUSD", "count", "medianPositivePE", "peCount"],
    [40, 25, 15, 25, 20],
  );
  for (const g of sectors)
    s.addRow([g.name, g.cap, g.count, g.medianPe, g.peCount]);
  s.getColumn(2).numFmt = "#,##0";
  return addLineChart(
    Buffer.from(await wb.xlsx.writeBuffer()),
    "Industries",
    sectors.slice(0, 12).map((g) => ({ date: g.name, close: g.cap })),
    {
      sheet: "Industries",
      column: "B",
      categoryColumn: "A",
      title: "Market cap USD · UNDATED",
      bar: true,
    },
  );
}

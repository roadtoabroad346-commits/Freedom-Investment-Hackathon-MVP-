import ExcelJS from "exceljs";
import type PptxGenJS from "pptxgenjs";
import { createRequire } from "node:module";
const pptxgen = createRequire(import.meta.url)("pptxgenjs") as typeof PptxGenJS;
import { universe, annualFacts, getModel } from "./data";
import { focusResearch } from "./research";
import { snapshot } from "./snapshot";
import { dcf, sensitivity, allocate } from "./finance";
import { scoreCompany } from "./screening";
import { usd, pct } from "./format";
export async function makeWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MIRROR X";
  wb.title = "Freedom 2026 — PRELIMINARY";
  wb.created = new Date(snapshot.generatedAt);
  wb.calcProperties.fullCalcOnLoad = true;
  function sheet(name: string) {
    const s = wb.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 2 }],
    });
    s.getColumn(1).width = 36;
    for (let i = 2; i <= 12; i++) s.getColumn(i).width = 21;
    s.addRow([`MIRROR X · PRELIMINARY · ${snapshot.id}`]);
    s.getRow(1).height = 25;
    s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    s.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF17253D" },
    };
    return s;
  }
  const readme = sheet("README");
  readme.addRows([
    ["Статус", "PRELIMINARY — НЕ ГОТОВО К СДАЧЕ"],
    ["Snapshot", snapshot.id],
    ["Срез", snapshot.cutoff],
    ["Правило цен", "Regular unadjusted close 2026-11-02; сейчас недоступно"],
    ["Единицы", "USD millions; shares millions; DCF result USD/share"],
    [
      "Факты",
      "Годовые факты из официальных документов; нужна сверка кварталов",
    ],
    [
      "Допущения",
      "Все драйверы в DCF — аналитические предположения, не прогноз эмитента",
    ],
    ["Расчёты", "Excel formulas + cached results; automatic recalc on open"],
    ["Источники", "SOURCES / COMPANY_FACTS"],
    [
      "Ограничение цен",
      "Общий набор UNDATED; не используется как текущая цена",
    ],
    [
      "12m target",
      "EV0*(1+WACC)-FCFF1-netDebt, затем / shares; долг/акции фиксированы",
    ],
    [
      "PayPal",
      "BNPL требует нормализации; клиентские средства исключены из cash",
    ],
    ["Риски", "Не является персональной рекомендацией. Buy не подтверждён."],
  ]);
  readme.getColumn(2).width = 105;
  const universeSheet = sheet("UNIVERSE_SCREENING");
  universeSheet.addRow([
    "Ticker",
    "Company",
    "Industry",
    "Price UNDATED",
    "Market cap USD",
    "P/E",
    "EBITDA USD",
    "Score",
    "Status",
    "Source",
  ]);
  universe.forEach((c) =>
    universeSheet.addRow([
      c.ticker,
      c.name,
      c.sector,
      c.price,
      c.marketCap,
      c.pe,
      c.ebitda,
      scoreCompany(c, universe).score,
      c.quality,
      c.sourceUrl,
    ]),
  );
  universeSheet.autoFilter = "A2:J505";
  const sources = sheet("SOURCES");
  sources.addRow([
    "Ticker",
    "Source",
    "Period",
    "Published / signed",
    "Status",
  ]);
  sources.addRow([
    "UNIVERSE",
    universe[0].sourceUrl,
    "UNKNOWN",
    "UNKNOWN",
    "UNDATED",
  ]);
  for (const [t, f] of Object.entries(annualFacts))
    sources.addRow([
      t,
      f.sourceUrl,
      f.periodEnd,
      f.filedAt,
      "ANNUAL FACTS / NEEDS QUARTERLY UPDATE",
    ]);
  sources.addRow([
    "MACRO",
    "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
    "2026-10-28",
    "2026-10-28",
    "Fed funds held 3.75–4.00%; not risk-free yield",
  ]);
  sources.getColumn(2).width = 110;
  const facts = sheet("COMPANY_FACTS");
  facts.addRow([
    "Ticker",
    "Period end",
    "Revenue",
    "Operating income",
    "Cash + ST inv.",
    "Debt",
    "Diluted shares",
    "Effective tax",
    "Source",
  ]);
  for (const [t, f] of Object.entries(annualFacts))
    facts.addRow([
      t,
      f.periodEnd,
      f.revenue,
      f.operatingIncome,
      f.cash,
      f.debt,
      f.dilutedShares,
      f.taxRate,
      f.sourceUrl,
    ]);
  for (const r of focusResearch) {
    const a = getModel(r.ticker)!,
      v = dcf(a),
      s = sheet(`DCF_${r.ticker}`);
    s.addRow(["Драйвер / единицы", "Значение", "Классификация"]);
    const inputs = [
      ["Revenue (USD mn)", a.revenue, "Annual report"],
      ["Annual growth", a.growth, "Analyst assumption"],
      ["Operating margin", a.margin, "Analyst assumption"],
      ["Tax rate", a.taxRate, "Analyst assumption"],
      ["D&A / revenue", a.daRate, "Analyst assumption"],
      ["CapEx / revenue", a.capexRate, "Analyst assumption"],
      ["NWC / revenue", a.nwcRate, "Analyst assumption"],
      ["WACC", a.wacc, "Scenario; not a measured CAPM WACC"],
      ["Terminal growth", a.terminalGrowth, "Analyst assumption"],
      ["Diluted shares (mn)", a.shares, "Annual weighted average"],
      ["Net debt (USD mn)", a.netDebt, "Debt - cash - short-term investments"],
    ];
    inputs.forEach((row) => s.addRow(row));
    for (let row = 4; row <= 11; row++) s.getCell(`B${row}`).numFmt = "0.00%";
    s.getCell("A16").value = "Forecast / USD mn";
    v.years.forEach((y, i) => {
      const col = String.fromCharCode(66 + i),
        prev = i === 0 ? "$B$3" : `${String.fromCharCode(65 + i)}17`;
      s.getCell(`${col}16`).value = y.year;
      const fs: [number, string, number][] = [
        [17, `${prev}*(1+$B$4)`, y.revenue],
        [18, `${col}17*$B$5`, y.ebit],
        [19, `${col}18*(1-$B$6)`, y.nopat],
        [20, `${col}17*$B$7`, y.da],
        [21, `${col}17*$B$8`, y.capex],
        [22, `(${col}17-${prev})*$B$9`, y.deltaNwc],
        [23, `${col}19+${col}20-${col}21-${col}22`, y.fcff],
        [24, `${col}23/(1+$B$10)^${y.year}`, y.pv],
      ];
      fs.forEach(
        ([row, formula, result]) =>
          (s.getCell(`${col}${row}`).value = { formula, result }),
      );
    });
    [
      "Revenue",
      "EBIT",
      "NOPAT",
      "D&A",
      "CapEx",
      "Delta NWC",
      "FCFF",
      "PV FCFF",
    ].forEach((n, i) => (s.getCell(`A${17 + i}`).value = n));
    const outs: [number, string, string, number][] = [
      [
        27,
        "FCFF year 6",
        "F17*(1+$B$11)*($B$5*(1-$B$6)+$B$7-$B$8)-F17*$B$11*$B$9",
        v.fcff6,
      ],
      [28, "Terminal value", "B27/($B$10-$B$11)", v.terminal],
      [29, "PV terminal", "B28/(1+$B$10)^5", v.terminalPv],
      [30, "Enterprise value", "SUM(B24:F24)+B29", v.ev],
      [31, "Equity value", "B30-$B$13", v.equity],
      [32, "Fair value / share", "B31/$B$12", v.fairValue],
      [
        33,
        "12m model target / share",
        "(B30*(1+$B$10)-B23-$B$13)/$B$12",
        v.target12m,
      ],
      [34, "Terminal share / EV", "B29/B30", v.terminalShare],
    ];
    outs.forEach(([row, name, formula, result]) => {
      s.getCell(`A${row}`).value = name;
      s.getCell(`B${row}`).value = { formula, result };
    });
    s.getCell("B34").numFmt = "0.0%";
    s.getCell("A36").value = "Source";
    s.getCell("B36").value = r.sourceUrl;
    s.getCell("A37").value = "Model anchor FY";
    s.getCell("B37").value = annualFacts[r.ticker].periodEnd;
    s.getCell("A38").value = "Do not treat as 02 Nov target";
    s.getCell("B38").value = "PRELIMINARY";
    s.getCell("A39").value = "Model check";
    s.getCell("B39").value = {
      formula: 'IF(AND(B10>B11,B12>0,B27>0),"PASS","FAIL")',
      result: "PASS",
    };
  }
  // Independent expression for sensitivity: recomputes every discounted annual cash flow.
  const valueExpr = (t: string, g: string, w: string, terminal: string) => {
    const p = `'DCF_${t}'!`,
      ref = (n: number) => `${p}$B$${n}`;
    const rev = ref(3),
      m = ref(5),
      tax = ref(6),
      da = ref(7),
      cap = ref(8),
      nwc = ref(9);
    const cash = (i: number) =>
      `(${rev}*(1+${g})^${i}*(${m}*(1-${tax})+${da}-${cap})-${rev}*(1+${g})^${i - 1}*${g}*${nwc})`;
    const f6 = `(${rev}*(1+${g})^5*(1+${terminal})*(${m}*(1-${tax})+${da}-${cap})-${rev}*(1+${g})^5*${terminal}*${nwc})`;
    return `((${[1, 2, 3, 4, 5].map((i) => `${cash(i)}/(1+${w})^${i}`).join("+")}+${f6}/(${w}-${terminal})/(1+${w})^5-${ref(13)})/${ref(12)})`;
  };
  const sens = sheet("SENSITIVITY");
  sens.addRow(["Ticker", "WACC / g", -0.01, -0.005, 0, 0.005, 0.01]);
  for (const r of focusResearch) {
    const a = getModel(r.ticker)!;
    for (const row of sensitivity(a)) {
      const line = sens.addRow([r.ticker, row.wacc]);
      line.getCell(2).numFmt = "0.00%";
      for (let j = 0; j < 5; j++) {
        const g = a.terminalGrowth + [-0.01, -0.005, 0, 0.005, 0.01][j];
        line.getCell(j + 3).value = {
          formula: valueExpr(
            r.ticker,
            `'DCF_${r.ticker}'!$B$4`,
            String(row.wacc),
            String(g),
          ),
          result: row.values[j] ?? "N/A",
        };
        line.getCell(j + 3).numFmt = "0.00";
      }
    }
  }
  const reverse = sheet("REVERSE");
  reverse.addRow(["Ticker", "Market price input", "Implied growth", "Status"]);
  for (const r of focusResearch) {
    const row = reverse.rowCount + 1;
    reverse.addRow([r.ticker, null, null, "Price not verified: blank"]);
    reverse.getCell(`C${row}`).value = {
      formula: `IF(B${row}="","N/A","See bisection block below")`,
      result: "N/A",
    };
  }
  let cursor = 8;
  for (const r of focusResearch) {
    const priceRow = focusResearch.indexOf(r) + 3;
    const pr = `B${priceRow}`;
    reverse.getCell(`C${priceRow}`).value = {
      formula: `IF(OR(${pr}="",${pr}<=0),"N/A",IF(OR(${pr}<${valueExpr(r.ticker, "-0.45", `'DCF_${r.ticker}'!$B$10`, `'DCF_${r.ticker}'!$B$11`)},${pr}>${valueExpr(r.ticker, "0.5", `'DCF_${r.ticker}'!$B$10`, `'DCF_${r.ticker}'!$B$11`)}),"N/A",D${cursor + 60}))`,
      result: "N/A",
    };
    reverse.getCell(`A${cursor}`).value = r.ticker;
    reverse.getCell(`B${cursor}`).value = "Lower growth";
    reverse.getCell(`C${cursor}`).value = "Upper growth";
    reverse.getCell(`D${cursor}`).value = "Mid growth";
    reverse.getCell(`E${cursor}`).value = "Model price";
    const priceCell = `$B$${focusResearch.indexOf(r) + 3}`;
    for (let k = 1; k <= 60; k++) {
      const n = cursor + k;
      reverse.getCell(`A${n}`).value = k;
      reverse.getCell(`B${n}`).value =
        k === 1
          ? -0.45
          : {
              formula: `IF(${priceCell}="","",IF(E${n - 1}<${priceCell},D${n - 1},B${n - 1}))`,
              result: "",
            };
      reverse.getCell(`C${n}`).value =
        k === 1
          ? 0.5
          : {
              formula: `IF(${priceCell}="","",IF(E${n - 1}<${priceCell},C${n - 1},D${n - 1}))`,
              result: "",
            };
      reverse.getCell(`D${n}`).value = {
        formula: `IF(${priceCell}="","",(B${n}+C${n})/2)`,
        result: "",
      };
      reverse.getCell(`E${n}`).value = {
        formula: `IF(${priceCell}="","",${valueExpr(r.ticker, `D${n}`, `'DCF_${r.ticker}'!$B$10`, `'DCF_${r.ticker}'!$B$11`)})`,
        result: "",
      };
    }
    cursor += 64;
  }
  const tech = sheet("TECHNICALS");
  tech.addRow([
    "Ticker",
    "SMA50",
    "SMA200",
    "Support",
    "Resistance",
    "Entry",
    "Exit",
    "Reason",
  ]);
  focusResearch.forEach((r) =>
    tech.addRow([
      r.ticker,
      null,
      null,
      null,
      null,
      null,
      null,
      "BLOCKED: no dated OHLCV. Never fabricate levels.",
    ]),
  );
  const risks = sheet("RISKS");
  risks.addRow([
    "Ticker",
    "Risk",
    "Probability",
    "Impact",
    "Invalidation trigger",
  ]);
  focusResearch.forEach((r) =>
    r.risks.forEach((v) =>
      risks.addRow([r.ticker, v.name, v.probability, v.impact, v.trigger]),
    ),
  );
  const portfolio = sheet("PORTFOLIO");
  portfolio.addRow([
    "Ticker",
    "Status",
    "Close 02 Nov",
    "12m model target",
    "Upside",
    "Weight",
    "Allocation USD",
    "Fair value today",
  ]);
  const alloc = allocate(snapshot.companies.map((c) => c.allocationBps));
  snapshot.companies.forEach((c, i) => {
    const n = i + 3;
    portfolio.addRow([
      c.ticker,
      c.recommendation,
      c.price,
      { formula: `'DCF_${c.ticker}'!B33`, result: c.target12m ?? "N/A" },
      {
        formula: `IF(OR(C${n}="",C${n}<=0),"N/A",D${n}/C${n}-1)`,
        result: c.upside ?? "N/A",
      },
      c.allocationBps / 10000,
      { formula: `F${n}*100000`, result: alloc[i] },
      { formula: `'DCF_${c.ticker}'!B32`, result: c.fairValue ?? "N/A" },
    ]);
    portfolio.getCell(`F${n}`).numFmt = "0.00%";
    portfolio.getCell(`E${n}`).numFmt = "0.00%";
  });
  portfolio.addRow([
    "TOTAL",
    null,
    null,
    null,
    null,
    { formula: "SUM(F3:F5)", result: 1 },
    { formula: "SUM(G3:G5)", result: 100000 },
  ]);
  portfolio.getCell("A8").value = "Weighted upside";
  portfolio.getCell("B8").value = {
    formula: 'IF(COUNT(E3:E5)=3,SUMPRODUCT(E3:E5,F3:F5),"N/A")',
    result: "N/A",
  };
  const checks = sheet("CHECKS");
  checks.addRow(["Check", "Result", "Explanation"]);
  checks.addRow([
    "Sum weights",
    {
      formula: 'IF(ABS(PORTFOLIO!F6-1)<0.0000001,"PASS","FAIL")',
      result: "PASS",
    },
    "Exactly 100%",
  ]);
  checks.addRow([
    "Capital",
    {
      formula: 'IF(ABS(PORTFOLIO!G6-100000)<0.005,"PASS","FAIL")',
      result: "PASS",
    },
    "$100,000",
  ]);
  checks.addRow(["3 reviewed Buy", "BLOCKED", "No analyst signoff"]);
  checks.addRow([
    "Close 2026-11-02",
    "BLOCKED",
    "Future official close unavailable",
  ]);
  checks.addRow([
    "Eligibility",
    "BLOCKED",
    "Liquidity/history/segment evidence missing",
  ]);
  checks.addRow(["Technical analysis", "BLOCKED", "No dated OHLCV"]);
  checks.addRow(["FINAL gate", "BLOCKED", "PRELIMINARY only"]);
  const snap = sheet("SNAPSHOT");
  Object.entries(snapshot)
    .filter(([k]) => !["companies", "blockers"].includes(k))
    .forEach(([k, v]) => snap.addRow([k, String(v)]));
  snapshot.blockers.forEach((b) => snap.addRow(["BLOCKER", b]));
  snap.getColumn(2).width = 110;
  for (const s of wb.worksheets) {
    s.eachRow((row, n) => {
      if (n > 1)
        row.eachCell((cell) => {
          cell.alignment = { vertical: "top", wrapText: true };
          if (
            typeof cell.value === "number" ||
            (cell.value &&
              typeof cell.value === "object" &&
              "formula" in cell.value)
          )
            cell.numFmt = cell.numFmt === "General" ? "0.00" : cell.numFmt;
        });
    });
    s.getRow(2).font = { bold: true, color: { argb: "FF17253D" } };
    s.getRow(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFF3F8" },
    };
  }
  return wb.xlsx.writeBuffer();
}
export async function makePresentation() {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "MIRROR X";
  pptx.subject = "PRELIMINARY — no reviewed Buy / no 02 Nov closing prices";
  pptx.title = "Freedom Investment Challenge 2026 — MIRROR X";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
  const navy = "17253D",
    green = "147D55",
    muted = "56677A";
  let slideNo = 0;
  const base = (title: string, section: string) => {
    const s = pptx.addSlide();
    slideNo++;
    s.background = { color: "F7F9FC" };
    s.addText(`MIRROR X / ${section}`, {
      x: 0.5,
      y: 0.26,
      w: 10,
      h: 0.2,
      fontSize: 9,
      color: muted,
      charSpacing: 1.4,
    });
    s.addText(title, {
      x: 0.5,
      y: 0.7,
      w: 12.2,
      h: 0.65,
      fontSize: 29,
      bold: true,
      color: navy,
      breakLine: false,
    });
    s.addShape(pptx.ShapeType.line, {
      x: 0.5,
      y: 6.96,
      w: 12.3,
      h: 0,
      line: { color: "D8E0E9", width: 1 },
    });
    s.addText("PRELIMINARY · НЕ ГОТОВО К СДАЧЕ · Buy не подтверждён", {
      x: 0.5,
      y: 7.07,
      w: 8,
      h: 0.18,
      fontSize: 8,
      color: "85500C",
    });
    s.addText(`${snapshot.id} / ${slideNo}`, {
      x: 9,
      y: 7.07,
      w: 3.8,
      h: 0.18,
      fontSize: 8,
      color: muted,
      align: "right",
    });
    return s;
  };
  const body = (
    s: ReturnType<typeof base>,
    text: string,
    x = 0.55,
    y = 1.65,
    w = 12,
    h = 4.7,
    size = 21,
  ) =>
    s.addText(text, {
      x,
      y,
      w,
      h,
      fontSize: size,
      color: navy,
      breakLine: false,
      paraSpaceAfter: 16,
      valign: "top",
      margin: 0,
    });
  const slide = base(
    "Сводка трёх основных исследований",
    "01 / РЕКОМЕНДАЦИИ — ОЖИДАЮТ ПРОВЕРКИ",
  );
  slide.addTable(
    [
      [
        "Компания",
        "Тикер",
        "Рекомендация",
        "Close 02.11",
        "12m target*",
        "Upside",
        "Вес",
      ],
      ...snapshot.companies.map((c) => [
        c.name,
        c.ticker,
        "NOT-RATED\nBuy не подтверждён",
        "N/A",
        usd(c.target12m),
        "N/A",
        pct(c.allocationBps / 10000),
      ]),
    ].map((row) => row.map((text) => ({ text }))),
    {
      x: 0.5,
      y: 1.75,
      w: 12.3,
      h: 2.2,
      border: { color: "DDE4EC", pt: 1 },
      fontFace: "Arial",
      fontSize: 14,
      color: navy,
      fill: { color: "FFFFFF" },
      rowH: 0.62,
      margin: 0.12,
      colW: [2.15, 0.8, 2.3, 1.4, 1.6, 1.05, 1],
      bold: false,
    },
  );
  body(
    slide,
    "$100 000 учебного капитала · 12 месяцев\n* Target — условный результат модели на базе годового отчёта.\nЦены закрытия 2 ноября ещё недоступны. Это рабочий пакет, а не готовые Buy-рекомендации.",
    0.55,
    4.6,
    12,
    1.6,
    18,
  );
  let s = base("От широкого поиска к проверяемому аргументу", "02 / ПОДХОД");
  body(
    s,
    "503 компании в импортированном наборе → реальные фильтры → отраслевой рейтинг → проверка фактов → DCF → контраргументы.\n\nРейтинг: 60% P/E-процентиль + 40% EBITDA / капитализация. Минимум 5 отраслевых аналогов. Пропуски не получают средний балл.\n\nAdobe, PayPal и Nike — выбранный фокус исследований. Алгоритм пока не доказал, что это лучшие три Buy.",
    0.55,
    1.6,
    12,
    4.8,
    22,
  );
  s = base("Готовность измеряется фактами", "03 / ВОРОНКА И КАЧЕСТВО");
  body(
    s,
    "503 импортированные компании · 3 годовые модели · 0 датированных котировок.\n\n0 подтверждённых contest PASS · 0 утверждённых Buy.\n\nОбщий набор имеет статус UNDATED. Он не доказывает актуальную недооценку. Для допуска нужны цена/капитализация 02.11, оборот за 3 месяца, история торгов и сегменты выручки.",
    0.55,
    1.6,
    12,
    4.8,
    23,
  );
  for (const r of focusResearch) {
    const f = annualFacts[r.ticker],
      v = dcf(getModel(r.ticker)!);
    s = base(
      `${r.ticker}: бизнес и инвестиционная гипотеза`,
      `${r.ticker} / BUSINESS`,
    );
    body(
      s,
      `${r.business}\n\nПреимущество: ${r.moat}\n\nГипотеза: ${r.thesis}\n\nМакро: ${r.macro.join(" ")}`,
      0.55,
      1.55,
      12,
      4.95,
      19,
    );
    s.addText(f.sourceUrl, {
      x: 0.55,
      y: 6.65,
      w: 12,
      h: 0.2,
      fontSize: 7,
      color: muted,
      hyperlink: { url: f.sourceUrl },
    });
    s = base(`${r.ticker}: оценка, риск и проверка`, `${r.ticker} / VALUATION`);
    body(
      s,
      `FY до ${f.periodEnd}: выручка ${f.revenue} млн USD; operating income ${f.operatingIncome} млн.\nDCF ${usd(v.fairValue)}; модельный 12m target ${usd(v.target12m)}. Нет текущей цены: upside N/A.\nДопущения: рост ${pct(r.assumptions.growth)}, маржа ${pct(r.assumptions.margin)}, WACC ${pct(r.assumptions.wacc)}.\nРиск: ${r.risks[0].name} — ${r.risks[0].probability}; ${r.risks[0].impact}.\nКатализатор: ${r.catalysts[0].event} — гипотеза, следующие 12 месяцев.\nТочка входа / выход: не определены — нет датированной OHLCV.\nОпровержение тезиса: ${r.risks[0].trigger}.`,
      0.55,
      1.5,
      12,
      5.0,
      18,
    );
    s.addText(f.sourceUrl, {
      x: 0.55,
      y: 6.65,
      w: 12,
      h: 0.2,
      fontSize: 7,
      color: muted,
      hyperlink: { url: f.sourceUrl },
    });
  }
  s = base("Что должно быть правдой?", "10 / REVERSE DCF");
  body(
    s,
    "Рост выручки определяется обратным расчётом из цены при фиксированных остальных допущениях.\n\nРешатель: бисекция, диапазон −45%…+50%; вне диапазона — N/A. Сейчас нет датированной цены: ожидания рынка не заявляются.\n\nWACC +1 п.п., рост −4 п.п. и маржа −3 п.п. доступны как стресс-сценарии. Высокая доля terminal value — отдельный риск модели.",
    0.55,
    1.6,
    12,
    4.8,
    22,
  );
  s = base("Макрофакторы проходят через бизнес", "11 / MACRO");
  body(
    s,
    "Факт: 28 октября ФРС сохранила диапазон 3,75–4,00%. Это не risk-free yield для WACC.\n\nAdobe: бюджеты бизнеса, AI-монетизация и стоимость инференса.\nPayPal: потребитель, трансграничные платежи и кредитный риск.\nNike: тарифы, покупательский спрос, USD и себестоимость.\n\nВыборы 3 ноября — неопределённость до дедлайна. Итоги не используются задним числом. Числа PCE/ВВП/нефти из PDF — ориентиры кейса.",
    0.55,
    1.55,
    12,
    4.9,
    20,
  );
  s.addText(
    "https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm",
    { x: 0.55, y: 6.65, w: 12, h: 0.2, fontSize: 8, color: muted },
  );
  s = base("$100 000: предварительное распределение", "12 / PORTFOLIO");
  body(
    s,
    focusResearch
      .map(
        (r) =>
          `${r.ticker} — ${pct(r.allocationBps / 10000)} / ${usd(r.allocationBps * 10)}\n${r.rationale}`,
      )
      .join("\n\n") +
      "\n\nСумма: 100% / $100 000. Это учебная аллокация. Взвешенная ожидаемая доходность не рассчитана: нет цен и подтверждённых Buy.",
    0.55,
    1.55,
    12,
    5.0,
    21,
  );
  s = base("Где портфель может ошибаться", "13 / RISK & RED TEAM");
  body(
    s,
    "Общий фактор: слабый потребитель и рост ставок могут одновременно ухудшить все три идеи. Три акции — концентрированный портфель.\n\nAdobe: AI может замещать платные инструменты. PayPal: рост processing без улучшения экономики checkout. Nike: длительное восстановление, скидки и тарифы.\n\nНет согласованной истории цен: корреляции и stop-loss не выдумываются. Вероятности рисков — мнение аналитика, а не статистическая модель.",
    0.55,
    1.6,
    12,
    4.8,
    22,
  );
  s = base("Сначала подтверждение. Затем Buy.", "14 / ИТОГ");
  body(
    s,
    "Adobe / PayPal / Nike — три основных кандидата на глубокую проверку. Рекомендации Buy ещё не утверждены.\n\nДо сдачи: обновить квартальные факты → загрузить close 02.11 и OHLCV → проверить eligibility → подтвердить тезисы, вход/выход и targets → зафиксировать единый snapshot → перевыгрузить PPTX и XLSX.\n\nДедлайн: 3 ноября 2026, 23:59 UTC+5. Способ отправки сообщают организаторы. Доходность и победа не гарантируются.",
    0.55,
    1.6,
    12,
    4.8,
    22,
  );
  return pptx.write({ outputType: "nodebuffer" });
}

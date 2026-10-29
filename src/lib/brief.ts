import { getCompany, annualFacts, getModel, universe } from "./data";
import { focusResearch } from "./research";
import { scoreCompany } from "./screening";
import { dcf } from "./finance";
import { usd, pct, number } from "./format";
import { snapshot } from "./snapshot";
export function researchBrief(ticker: string) {
  const c = getCompany(ticker);
  if (!c) return null;
  const f = annualFacts[ticker],
    r = focusResearch.find((r) => r.ticker === ticker),
    m = getModel(ticker),
    s = scoreCompany(c, universe);
  let text = `# MIRROR X — ${ticker} / ${c.name}\n\nСтатус: PRELIMINARY / NOT-RATED\nСрез: ${snapshot.cutoff}; snapshot ${snapshot.id}\n\nОтрасль: ${c.sector}\nКотировка набора: ${usd(c.price)}; дата неизвестна (UNDATED). Не текущая цена.\nПодтверждённая текущая цена: N/A. Upside: N/A.\nРейтинг исследования: ${s.score ?? "N/A"}. ${s.reason}\nИсточник общего набора: ${c.sourceUrl}\n`;
  if (f)
    text += `\n## Факты годового отчёта\n\nПериод: ${f.periodEnd}; документ: ${f.filedAt}. USD millions.\nВыручка: ${f.revenue}; operating income: ${f.operatingIncome}; cash + short-term investments: ${f.cash}; debt: ${f.debt}; diluted shares (millions): ${f.dilutedShares}.\nИсточник: ${f.sourceUrl}\n`;
  if (r)
    text += `\n## Гипотезы аналитика\n\nБизнес: ${r.business}\nПреимущество: ${r.moat}\nТезис: ${r.thesis}\nКонтраргумент: ${r.contra}\n\nМакро:\n${r.macro.map((m) => "- " + m).join("\n")}\n\nРиски:\n${r.risks.map((v) => `- ${v.name}; ${v.probability}; ${v.impact}; опровержение: ${v.trigger}`).join("\n")}\n\nКатализаторы (сценарии):\n${r.catalysts.map((v) => `- ${v.event}: ${v.window}. ${v.evidence}`).join("\n")}\n`;
  if (m) {
    const o = dcf(m);
    text += `\n## Модель на базе годового периода\n\nFair value: ${usd(o.fairValue)}; модельный 12m target: ${usd(o.target12m)}. Нет текущей цены: upside не рассчитывается.\nДопущения: рост ${pct(m.growth)}, маржа ${pct(m.margin)}, WACC ${pct(m.wacc)}, terminal growth ${pct(m.terminalGrowth)}, налог ${pct(m.taxRate)}, D&A/revenue ${pct(m.daRate)}, CapEx/revenue ${pct(m.capexRate)}, NWC/revenue ${pct(m.nwcRate)}. Это предположения аналитика.\nСтресс WACC +1 п.п.: ${usd(dcf({ ...m, wacc: m.wacc + 0.01 }).fairValue)}.\nМост target: (EV*(1+WACC)-FCFF1-netDebt)/shares; net debt и shares фиксированы. База модели не обновлена до конкурсной даты.\nTerminal value: ${number(o.terminalShare * 100)}% EV.\n`;
  } else
    text +=
      "\nDCF: недоступна — отсутствуют валидированные входы или требуется отраслевая модель.\n";
  return (
    text +
    "\nТехнический анализ: нет датированной OHLCV. Buy не подтверждён. Исследование не гарантирует доходность.\n"
  );
}

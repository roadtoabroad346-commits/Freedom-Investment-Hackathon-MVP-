"use client";
import { useMemo, useState } from "react";
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { BusinessFact } from "@/lib/market/schema";
import { Chart, ChartPanel, colors } from "./chart";
import { Stat, Notice } from "../ui";
import { usd, pct, number } from "@/lib/format";
export function Business({ financials }: { financials: BusinessFact[] }) {
  const tickers = [...new Set(financials.map((f) => f.ticker))];
  const [chosen, setChosen] = useState("");
  const ticker = tickers.includes(chosen) ? chosen : tickers[0];
  const rows = useMemo(
    () =>
      financials
        .filter((f) => f.ticker === ticker)
        .map((f) => ({ ...f, margin: (f.operatingIncome / f.revenue) * 100 })),
    [financials, ticker],
  );
  const last = rows.at(-1);
  if (!last)
    return (
      <div className="empty">
        <h2>Показатели вашего бизнеса — наглядно</h2>
        <p>
          Загрузите лист Financials с выручкой, operating income, денежными
          средствами и долгом. Сравнивайте одинаковые по длительности периоды;
          все суммы в USD.
        </p>
      </div>
    );
  return (
    <>
      <Notice>
        Данные загружены пользователем и не прошли внешний аудит. Все суммы —
        USD. Периоды должны иметь одинаковую длительность и методику учёта;
        приложение не определяет это автоматически.
      </Notice>
      <div className="market-controls">
        <label>
          Компания / мой бизнес
          <select value={ticker} onChange={(e) => setChosen(e.target.value)}>
            {tickers.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="stats-row">
        <Stat
          label="Выручка последнего периода"
          value={usd(last.revenue)}
          note={last.periodEnd}
        />
        <Stat
          label="Operating income"
          value={usd(last.operatingIncome)}
          note="До процентов и налога на прибыль"
        />
        <Stat
          label="Операционная маржа"
          value={pct(last.operatingIncome / last.revenue)}
          note="Operating income / Revenue"
        />
        <Stat
          label="Чистый долг"
          value={usd(last.debt - last.cash)}
          note="Отрицательный = денег больше долга"
        />
      </div>
      <ChartPanel
        title={`${ticker} · выручка и рентабельность`}
        note="Суммы в USD, маржа на правой оси. История из вашего файла."
      >
        <Chart label="Выручка, операционная прибыль и маржа по периодам">
          <ComposedChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="periodEnd" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="usd" tick={{ fontSize: 10 }} width={75} />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 10 }}
              unit="%"
            />
            <Tooltip
              formatter={(v, n) => [
                `${number(Number(v), 2)}${n === "Маржа" ? "%" : " USD"}`,
                String(n),
              ]}
            />
            <Legend />
            <Bar
              dataKey="revenue"
              name="Выручка"
              yAxisId="usd"
              fill={colors[1]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="operatingIncome"
              name="Операционная прибыль"
              yAxisId="usd"
              fill={colors[0]}
              isAnimationActive={false}
            />
            <Line
              dataKey="margin"
              name="Маржа"
              yAxisId="pct"
              stroke={colors[2]}
              isAnimationActive={false}
            />
          </ComposedChart>
        </Chart>
      </ChartPanel>
      <ChartPanel
        title="Денежная позиция и долг"
        note="Балансовые остатки на конец каждого периода. Это не отчёт о движении денежных средств."
      >
        <Chart label="Денежные средства и долг по периодам" height={250}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="periodEnd" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={75} />
            <Tooltip formatter={(v) => usd(Number(v))} />
            <Legend />
            <Bar
              dataKey="cash"
              name="Денежные средства"
              fill={colors[0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="debt"
              name="Долг"
              fill={colors[2]}
              isAnimationActive={false}
            />
          </BarChart>
        </Chart>
        <details>
          <summary>Таблица периодов и источников</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Период</th>
                  <th>Выручка</th>
                  <th>Operating income</th>
                  <th>Cash</th>
                  <th>Debt</th>
                  <th>Источник</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.periodEnd}>
                    <td>{r.periodEnd}</td>
                    <td>{usd(r.revenue)}</td>
                    <td>{usd(r.operatingIncome)}</td>
                    <td>{usd(r.cash)}</td>
                    <td>{usd(r.debt)}</td>
                    <td>{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </ChartPanel>
    </>
  );
}

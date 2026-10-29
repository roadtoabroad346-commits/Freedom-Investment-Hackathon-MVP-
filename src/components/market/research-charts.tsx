"use client";
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { AnnualFact, Assumptions } from "@/lib/types";
import { dcf, scenarios } from "@/lib/finance";
import { Chart, ChartPanel, colors } from "./chart";
import { number, usd } from "@/lib/format";
export function FundamentalCharts({
  fact,
  ticker,
}: {
  fact: AnnualFact;
  ticker: string;
}) {
  const history = fact.history.map((h) => ({
    ...h,
    margin: (h.operatingIncome / h.revenue) * 100,
  }));
  return (
    <ChartPanel
      title={`${ticker} · бизнес в цифрах`}
      note={`Годовые отчёты · млн USD · последний FY до ${fact.periodEnd}. Прибыль — operating income, не чистая прибыль.`}
    >
      <Chart label="Выручка, операционная прибыль и операционная маржа по годам">
        <ComposedChart data={history} margin={{ left: 0, right: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="usd" tick={{ fontSize: 11 }} width={65} />
          <YAxis
            yAxisId="pct"
            orientation="right"
            unit="%"
            tick={{ fontSize: 11 }}
            width={45}
          />
          <Tooltip
            formatter={(v, n) => [
              `${number(Number(v), 1)}${n === "Маржа" ? "%" : " млн USD"}`,
              String(n),
            ]}
          />
          <Legend />
          <Bar
            yAxisId="usd"
            dataKey="revenue"
            name="Выручка"
            fill={colors[1]}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            yAxisId="usd"
            dataKey="operatingIncome"
            name="Операционная прибыль"
            fill={colors[0]}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            yAxisId="pct"
            dataKey="margin"
            name="Маржа"
            stroke={colors[2]}
            strokeWidth={2}
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </Chart>
      <details>
        <summary>Числа и источник</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Год</th>
                <th>Выручка</th>
                <th>Операционная прибыль</th>
                <th>Маржа</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.year}>
                  <td>{h.year}</td>
                  <td>{number(h.revenue, 0)}</td>
                  <td>{number(h.operatingIncome, 0)}</td>
                  <td>{number(h.margin)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <a
          href={fact.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link"
        >
          Годовой отчёт ↗
        </a>
      </details>
    </ChartPanel>
  );
}
export function DcfCharts({ assumptions: a }: { assumptions: Assumptions }) {
  const r = dcf(a);
  return (
    <>
      <ChartPanel
        title="Как модель создаёт стоимость"
        note="Прогноз FCFF и его приведённая стоимость, млн USD. Это расчёт из допущений."
      >
        <Chart
          label="Пять лет прогнозного FCFF и дисконтированной стоимости"
          height={250}
        >
          <BarChart data={r.years}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} width={65} />
            <Tooltip formatter={(v) => `${number(Number(v), 0)} млн USD`} />
            <Legend />
            <Bar
              dataKey="fcff"
              name="FCFF"
              fill={colors[0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="pv"
              name="PV FCFF"
              fill={colors[1]}
              isAnimationActive={false}
            />
          </BarChart>
        </Chart>
        <div className="metric-line">
          <span>Доля terminal value в EV</span>
          <b>{number(r.terminalShare * 100)}%</b>
        </div>
        <p className="chart-footnote">
          Чем выше доля terminal value, тем сильнее оценка зависит от дальних
          допущений.
        </p>
      </ChartPanel>
      <ChartPanel
        title="Диапазон сценариев"
        note="Условная стоимость за акцию, USD. Сценарии не являются вероятностями."
      >
        <Chart
          label="Стоимость за акцию в сценариях Bear, Base, Bull"
          height={200}
        >
          <BarChart
            data={scenarios(a)}
            layout="vertical"
            margin={{ right: 15 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={45}
            />
            <Tooltip formatter={(v) => usd(Number(v))} />
            <Bar
              dataKey="fairValue"
              name="Стоимость за акцию"
              fill={colors[0]}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </Chart>
      </ChartPanel>
    </>
  );
}
export function ComparisonChart({
  facts,
}: {
  facts: { ticker: string; fact: AnnualFact }[];
}) {
  return (
    <ChartPanel
      title="Масштаб и прибыльность"
      note="Выручка и operating income, млн USD. Финансовые периоды у компаний различаются; это сравнение масштаба, а не доходности акций."
    >
      <Chart label="Сравнение выручки и операционной прибыли компаний">
        <BarChart data={facts.map(({ ticker, fact }) => ({ ticker, ...fact }))}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="ticker" />
          <YAxis tick={{ fontSize: 10 }} width={65} />
          <Tooltip formatter={(v) => `${number(Number(v), 0)} млн USD`} />
          <Legend />
          <Bar
            dataKey="revenue"
            name="Выручка"
            fill={colors[1]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="operatingIncome"
            name="Операционная прибыль"
            fill={colors[0]}
            isAnimationActive={false}
          />
        </BarChart>
      </Chart>
      <p className="chart-footnote">
        {facts
          .map(({ ticker, fact }) => `${ticker}: FY до ${fact.periodEnd}`)
          .join(" · ")}
      </p>
    </ChartPanel>
  );
}

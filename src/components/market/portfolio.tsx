"use client";
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { Workspace } from "@/lib/market/schema";
import { portfolioMetrics } from "@/lib/market/analytics";
import { Chart, ChartPanel, colors } from "./chart";
import { usd, pct, number } from "@/lib/format";
import { Stat, Notice } from "../ui";
export function Portfolio({ workspace: w }: { workspace: Workspace }) {
  const p = useMemo(() => portfolioMetrics(w), [w]);
  if (!p.rows.length)
    return (
      <div className="empty">
        <h2>Ваш портфель — в одной картине</h2>
        <p>
          Загрузите лист Positions: тикер, количество, средняя стоимость и
          сектор. Котировки из Prices будут использованы для оценки.
        </p>
      </div>
    );
  const priced = p.rows.filter((r) => r.value !== null);
  return (
    <>
      <Notice>
        Стоимость рассчитана по последнему загруженному close каждого тикера.
        Даты могут различаться.{" "}
        {p.dates.length > 1
          ? `Разные даты оценки: ${p.dates[0]} — ${p.dates.at(-1)}.`
          : p.dates[0]
            ? `Дата: ${p.dates[0]}.`
            : "Нет цен для оценки."}{" "}
        {p.missing > 0
          ? `Не оценены ${p.missing} позиций; итоги и веса охватывают только оценённую часть.`
          : ""}{" "}
        P/L не учитывает дивиденды, комиссии, денежные остатки и закрытые
        сделки.
      </Notice>
      <div className="stats-row">
        <Stat
          label="Стоимость оценённых позиций"
          value={usd(p.total)}
          note={`${priced.length} из ${p.rows.length} позиций`}
        />
        <Stat
          label="Их себестоимость"
          value={usd(p.cost)}
          note="Количество × средняя стоимость"
        />
        <Stat
          label="Нереализованный P/L"
          value={usd(p.pnl)}
          note={pct(p.returnOnCost)}
        />
        <Stat
          label="Крупнейшая доля"
          value={
            priced.length ? pct(Math.max(...priced.map((r) => r.weight!))) : "—"
          }
          note="От стоимости оценённой части"
        />
      </div>
      <div className="analytics-grid">
        <ChartPanel
          title="Распределение по активам"
          note="Доли по стоимости оценённых позиций."
        >
          {priced.length ? (
            <Chart label="Распределение портфеля по активам">
              <PieChart>
                <Pie
                  data={priced}
                  dataKey="value"
                  nameKey="ticker"
                  innerRadius="52%"
                  outerRadius="76%"
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {priced.map((r, i) => (
                    <Cell key={r.ticker} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => usd(Number(v))} />
                <Legend />
              </PieChart>
            </Chart>
          ) : (
            <p>Загрузите цены для позиций.</p>
          )}
        </ChartPanel>
        <ChartPanel
          title="Прибыль и убыток по позициям"
          note="Абсолютный P/L, USD · только открытые позиции."
        >
          <Chart label="Прибыль и убыток по тикерам">
            <BarChart
              data={priced.slice(0, 25)}
              margin={{ left: 0, right: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="ticker" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <ReferenceLine y={0} stroke="#78879d" />
              <Tooltip formatter={(v) => usd(Number(v))} />
              <Bar dataKey="pnl" isAnimationActive={false}>
                {priced.slice(0, 25).map((r) => (
                  <Cell
                    key={r.ticker}
                    fill={r.pnl! >= 0 ? colors[0] : "#b6403a"}
                  />
                ))}
              </Bar>
            </BarChart>
          </Chart>
          {priced.length > 25 && (
            <small>Первые 25 позиций; все позиции — в таблице.</small>
          )}
        </ChartPanel>
      </div>
      <ChartPanel
        title="Отраслевая концентрация"
        note="Сектора берутся из вашего файла; «Не указан» требует уточнения."
      >
        <div className="allocation-bars">
          {p.sectors
            .sort((a, b) => b.value - a.value)
            .map((s, i) => (
              <div key={s.name}>
                <span>{s.name}</span>
                <div>
                  <i
                    style={{
                      width: `${(s.value / p.total) * 100}%`,
                      background: colors[i % colors.length],
                    }}
                  />
                </div>
                <b>{pct(s.value / p.total)}</b>
              </div>
            ))}
        </div>
      </ChartPanel>
      <section className="panel">
        <h2>Позиции и качество оценки</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Тикер</th>
                <th>Количество</th>
                <th>Средняя цена</th>
                <th>Close / дата</th>
                <th>Стоимость</th>
                <th>P/L</th>
                <th>Вес</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.ticker}>
                  <td>
                    <b>{r.ticker}</b>
                    <small className="block muted">{r.sector}</small>
                  </td>
                  <td>{number(r.quantity, 4)}</td>
                  <td>{usd(r.averageCost)}</td>
                  <td>
                    {usd(r.price)}
                    <small className="block muted">
                      {r.date ?? "Нет цены"}
                    </small>
                  </td>
                  <td>{usd(r.value)}</td>
                  <td>{usd(r.pnl)}</td>
                  <td>{pct(r.weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

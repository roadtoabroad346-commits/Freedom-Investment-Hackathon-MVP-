"use client";
import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Brush,
  ReferenceLine,
} from "recharts";
import type { Workspace, MarketBar } from "@/lib/market/schema";
import { seriesMetrics, alignedComparison } from "@/lib/market/analytics";
import { usd, pct, number, compact } from "@/lib/format";
import { Chart, ChartPanel, colors } from "./chart";
import { Stat } from "../ui";
function Candles({ bars }: { bars: MarketBar[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const visible = bars.slice(-180);
  const min = Math.min(...visible.map((b) => b.low!)),
    max = Math.max(...visible.map((b) => b.high!));
  const pad = (max - min) * 0.08 || 1;
  const y = (v: number) =>
    275 - ((v - min + pad) / (max - min + 2 * pad)) * 240;
  const step = 800 / Math.max(1, visible.length);
  const current = visible[selected ?? visible.length - 1];
  return (
    <>
      <div className="candle-readout" aria-live="polite">
        {current && (
          <>
            <b>{current.date}</b>
            <span>O {usd(current.open)}</span>
            <span>H {usd(current.high)}</span>
            <span>L {usd(current.low)}</span>
            <span>C {usd(current.close)}</span>
          </>
        )}
      </div>
      <svg
        className="candles"
        viewBox="0 0 900 320"
        role="img"
        aria-label="Свечной график OHLC. Свечи доступны с клавиатуры; цифры в таблице ниже."
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const value = min - pad + ((max - min + 2 * pad) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={65}
                x2={875}
                y1={y(value)}
                y2={y(value)}
                stroke="#e1e7ef"
                strokeDasharray="3 3"
              />
              <text x={0} y={y(value) + 4} fontSize={12} fill="#5e6b7d">
                {number(value, 2)}
              </text>
            </g>
          );
        })}
        {visible.map((b, i) => {
          const x = 70 + step * (i + 0.5),
            up = b.close >= b.open!,
            color = up ? colors[0] : "#b6403a";
          return (
            <g
              key={b.date}
              tabIndex={0}
              role="button"
              aria-label={`${b.date}: O ${b.open}, H ${b.high}, L ${b.low}, C ${b.close}`}
              onFocus={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(i);
                }
              }}
            >
              <rect
                x={x - step / 2}
                y={20}
                width={step}
                height={260}
                fill="transparent"
              />
              <line
                x1={x}
                x2={x}
                y1={y(b.high!)}
                y2={y(b.low!)}
                stroke={color}
              />
              <rect
                x={x - Math.max(1, step * 0.32)}
                y={y(Math.max(b.open!, b.close))}
                width={Math.max(2, step * 0.64)}
                height={Math.max(1, Math.abs(y(b.open!) - y(b.close)))}
                fill={up ? "#eaf5ef" : color}
                stroke={color}
              />
            </g>
          );
        })}
        <text x={70} y={308} fontSize={12} fill="#5e6b7d">
          {visible[0]?.date}
        </text>
        <text x={875} y={308} textAnchor="end" fontSize={12} fill="#5e6b7d">
          {visible.at(-1)?.date}
        </text>
      </svg>
      <p className="chart-footnote">
        Полая свеча — close ≥ open; заполненная — close &lt; open. Показаны
        последние {visible.length} наблюдений выбранного диапазона (максимум
        180).
      </p>
    </>
  );
}
export function HistoryCharts({ workspace: w }: { workspace: Workspace }) {
  const tickers = useMemo(
    () => [...new Set(w.bars.map((b) => b.ticker))],
    [w.bars],
  );
  const [chosen, setChosen] = useState(""),
    [range, setRange] = useState("ALL"),
    [mode, setMode] = useState("line"),
    [ma, setMa] = useState(true);
  const ticker = tickers.includes(chosen) ? chosen : tickers[0];
  const bars = useMemo(() => {
    const all = w.bars.filter((b) => b.ticker === ticker);
    if (range === "ALL" || !all.length) return all;
    const date = new Date(all.at(-1)!.date + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - Number(range));
    return all.filter((b) => b.date >= date.toISOString().slice(0, 10));
  }, [w.bars, ticker, range]);
  const metrics = useMemo(() => seriesMetrics(bars), [bars]);
  const fullOhlc =
    bars.length > 0 &&
    bars.every((b) => b.open !== null && b.high !== null && b.low !== null);
  const comparison = useMemo(
    () => alignedComparison(w.bars, tickers.slice(0, 5)),
    [w.bars, tickers],
  );
  if (!tickers.length)
    return (
      <div className="empty">
        <h2>Загрузите историю, чтобы увидеть движение цены</h2>
        <p>
          Достаточно ticker, date, close. Для свечей добавьте open, high, low;
          для объёмов — volume.
        </p>
      </div>
    );
  return (
    <>
      <div className="market-controls">
        <label>
          Инструмент
          <select value={ticker} onChange={(e) => setChosen(e.target.value)}>
            {tickers.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="segmented" aria-label="Диапазон истории">
          {[
            ["30", "1М"],
            ["90", "3М"],
            ["365", "1Г"],
            ["ALL", "Всё"],
          ].map(([v, l]) => (
            <button
              key={v}
              aria-pressed={range === v}
              onClick={() => setRange(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <label>
          Тип графика
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="line">Линия</option>
            <option value="candles" disabled={!fullOhlc}>
              Свечи OHLC
            </option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={ma}
            onChange={(e) => setMa(e.target.checked)}
          />
          SMA 20 / 50
        </label>
      </div>
      <div className="stats-row">
        <Stat
          label={`${ticker} · последняя цена`}
          value={usd(metrics.last?.close)}
          note={metrics.last?.date}
        />
        <Stat
          label="Изменение за диапазон"
          value={pct(metrics.change)}
          note="Price return, без дивидендов"
        />
        <Stat
          label="Максимальная просадка"
          value={pct(metrics.maxDrawdown)}
          note="По закрытиям в диапазоне"
        />
        <Stat
          label="Волатильность / наблюдение"
          value={pct(metrics.volatility)}
          note={`${metrics.observations} интервалов · без годовой экстраполяции`}
        />
      </div>
      <ChartPanel
        title={`${ticker} · история торгов`}
        note={`${metrics.first?.date} → ${metrics.last?.date} · USD · источник: ${w.source}`}
      >
        {mode === "candles" && fullOhlc ? (
          <Candles key={ticker + range} bars={bars} />
        ) : (
          <Chart
            label={`${ticker}: закрытие и скользящие средние`}
            height={360}
          >
            <ComposedChart
              data={metrics.points}
              syncId="prices"
              margin={{ left: 0, right: 12, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" minTickGap={50} tick={{ fontSize: 11 }} />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 11 }}
                width={65}
              />
              <Tooltip
                formatter={(v, n) => [
                  usd(v === null ? null : Number(v)),
                  String(n),
                ]}
              />
              <Legend />
              <Line
                dataKey="close"
                name="Close USD"
                stroke={colors[0]}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
              {ma && (
                <>
                  <Line
                    dataKey="sma20"
                    name="SMA 20"
                    stroke={colors[1]}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="sma50"
                    name="SMA 50"
                    stroke={colors[2]}
                    dot={false}
                    strokeDasharray="5 3"
                    isAnimationActive={false}
                  />
                </>
              )}
              <Brush
                dataKey="date"
                height={25}
                stroke="#8295ae"
                travellerWidth={10}
              />
            </ComposedChart>
          </Chart>
        )}
        <p className="chart-footnote">
          SMA рассчитываются по наблюдениям выбранного диапазона. Пропущенные
          даты не заполняются. Цены:{" "}
          {w.priceBasis === "adjusted"
            ? "скорректированные по указанию пользователя"
            : w.priceBasis === "unadjusted"
              ? "без корректировки"
              : "тип корректировки не указан"}
          ; сплиты могут искажать доходность.
        </p>
        {bars.some((b) => b.volume !== null) ? (
          <Chart label="Объём торгов в акциях" height={150}>
            <ComposedChart
              data={metrics.points}
              syncId="prices"
              margin={{ left: 0, right: 12 }}
            >
              <XAxis dataKey="date" hide />
              <YAxis
                tickFormatter={(v) => compact(v)}
                width={65}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                formatter={(v) => [number(Number(v), 0), "Объём, акции"]}
              />
              <Bar dataKey="volume" fill="#9aafc9" isAnimationActive={false} />
            </ComposedChart>
          </Chart>
        ) : (
          <p className="chart-footnote">Объёмы не загружены.</p>
        )}
      </ChartPanel>
      <div className="analytics-grid">
        <ChartPanel
          title="Просадка от локального пика"
          note="0% — максимум внутри выбранного диапазона; ниже — снижение от него."
        >
          <Chart label="Просадка, проценты" height={240}>
            <AreaChart data={metrics.points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" minTickGap={60} tick={{ fontSize: 10 }} />
              <YAxis unit="%" tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v) => [`${number(Number(v))}%`, "Просадка"]}
              />
              <ReferenceLine y={0} stroke="#8c98aa" />
              <Area
                dataKey="drawdown"
                type="linear"
                stroke="#b6403a"
                fill="#f9dfda"
                isAnimationActive={false}
              />
            </AreaChart>
          </Chart>
        </ChartPanel>
        <ChartPanel
          title="Сравнение: старт = 100"
          note="До 5 тикеров. Только общие даты, без заполнения пропусков; первая общая дата = 100."
        >
          {comparison.length >= 2 ? (
            <Chart label="Нормализованные цены на общих датах" height={240}>
              <LineChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" minTickGap={60} tick={{ fontSize: 10 }} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => number(Number(v), 2)} />
                <Legend />
                {tickers.slice(0, 5).map((t, i) => (
                  <Line
                    key={t}
                    dataKey={t}
                    stroke={colors[i]}
                    dot={false}
                    strokeDasharray={i % 2 ? "5 3" : undefined}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </Chart>
          ) : (
            <div className="chart-loading">Нужно не менее двух общих дат.</div>
          )}
        </ChartPanel>
      </div>
      <details className="panel">
        <summary>Данные графика · последние 100 строк</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {bars.slice(-100).map((b) => (
                <tr key={b.date}>
                  <td>{b.date}</td>
                  <td>{usd(b.open)}</td>
                  <td>{usd(b.high)}</td>
                  <td>{usd(b.low)}</td>
                  <td>{usd(b.close)}</td>
                  <td>{number(b.volume, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

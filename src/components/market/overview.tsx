"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import type { Instrument } from "@/lib/types";
import { sectorOverview } from "@/lib/market/analytics";
import { compact, number } from "@/lib/format";
import { Chart, ChartPanel, colors } from "./chart";
export function MarketOverview({ universe }: { universe: Instrument[] }) {
  const [sector, setSector] = useState(""),
    [metric, setMetric] = useState<"cap" | "count">("cap"),
    [query, setQuery] = useState(""),
    [peLimit, setPeLimit] = useState(100),
    [ratioLimit, setRatioLimit] = useState(40);
  const sectors = useMemo(() => sectorOverview(universe), [universe]);
  const filtered = useMemo(
    () =>
      universe.filter(
        (c) =>
          (!sector || c.sector === sector) &&
          (!query ||
            `${c.ticker} ${c.name}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [universe, sector, query],
  );
  const leaders = [...filtered]
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, 12);
  const scatter = filtered
    .filter(
      (c) =>
        c.pe !== null &&
        c.pe > 0 &&
        c.ebitda !== null &&
        c.marketCap !== null &&
        c.marketCap > 0,
    )
    .map((c) => ({
      ticker: c.ticker,
      x: c.pe!,
      y: (c.ebitda! / c.marketCap!) * 100,
      z: c.marketCap!,
      sector: c.sector,
    }));
  const visibleScatter = scatter.filter(
    (p) => p.x <= peLimit && Math.abs(p.y) <= ratioLimit,
  );
  const total = sectors.reduce((s, c) => s + c.cap, 0);
  return (
    <>
      <div className="market-controls">
        <label>
          Сектор
          <select
            aria-label="Сектор"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            <option value="">Все секторы</option>
            {sectors.map((s) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          Поиск компании
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Тикер или название"
            maxLength={80}
          />
        </label>
        <span className="badge neutral" data-testid="market-count">
          {filtered.length} компаний
        </span>
      </div>
      <ChartPanel
        title="Карта крупнейших отраслей"
        note="Размеры блоков ориентировочные; нижняя полоса показывает долю капитализации. Цвет обозначает сектор, а не рост или падение."
        action={
          <label>
            Размер блока
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as "cap" | "count")}
            >
              <option value="cap">Капитализация</option>
              <option value="count">Число компаний</option>
            </select>
          </label>
        }
      >
        <div className="sector-mosaic">
          {sectors.slice(0, 12).map((s, i) => (
            <button
              key={s.name}
              className={`sector-tile ${sector === s.name ? "selected" : ""}`}
              style={{
                flexGrow:
                  metric === "cap"
                    ? Math.max(1, (s.cap / total) * 100)
                    : s.count,
                borderTopColor: colors[i % colors.length],
              }}
              onClick={() => setSector(sector === s.name ? "" : s.name)}
              aria-pressed={sector === s.name}
            >
              <span>{s.name}</span>
              <strong>
                {metric === "cap" ? `$${compact(s.cap)}` : s.count}
              </strong>
              <small>
                {s.count} компаний · медиана P/E {number(s.medianPe)}
              </small>
              <div
                className="tile-meter"
                style={{
                  background: colors[i % colors.length],
                  width: `${(s.cap / total) * 100}%`,
                }}
              />
            </button>
          ))}
        </div>
        <p className="chart-footnote">
          Показаны 12 крупнейших отраслей из {sectors.length}. Все отрасли
          доступны в фильтре и таблице. Нажмите блок для фильтрации. Сумма
          капитализаций включает только известные значения; UNDATED — дата
          исходного среза не подтверждена.
        </p>
      </ChartPanel>
      <div className="analytics-grid">
        <ChartPanel
          title="Крупнейшие компании"
          note="Капитализация, млрд USD · UNDATED"
        >
          <Chart
            label="Капитализация 12 крупнейших отфильтрованных компаний"
            height={360}
          >
            <BarChart
              data={leaders.map((c) => ({
                ticker: c.ticker,
                cap: (c.marketCap ?? 0) / 1e9,
              }))}
              layout="vertical"
              margin={{ left: 0, right: 20, top: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="ticker"
                type="category"
                width={62}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) => [
                  `$${number(Number(v))} млрд`,
                  "Капитализация",
                ]}
              />
              <Bar
                dataKey="cap"
                fill={colors[0]}
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </Chart>
        </ChartPanel>
        <ChartPanel
          title="Оценка и операционный масштаб"
          note="X: P/E · Y: EBITDA / капитализация, % · размер: капитализация. Этот коэффициент не является FCF yield."
        >
          <div className="scatter-controls">
            <label>
              P/E до
              <input
                type="number"
                min={1}
                max={10000}
                value={peLimit}
                onChange={(e) =>
                  setPeLimit(
                    Math.max(1, Math.min(10000, Number(e.target.value))),
                  )
                }
              />
            </label>
            <label>
              |EBITDA / cap| до, %
              <input
                type="number"
                min={1}
                max={10000}
                value={ratioLimit}
                onChange={(e) =>
                  setRatioLimit(
                    Math.max(1, Math.min(10000, Number(e.target.value))),
                  )
                }
              />
            </label>
          </div>
          <Chart label="Диаграмма P/E и EBITDA к капитализации" height={360}>
            <ScatterChart margin={{ top: 15, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="P/E"
                tick={{ fontSize: 11 }}
                label={{ value: "P/E", position: "insideBottom", offset: -10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="EBITDA / cap"
                unit="%"
                tick={{ fontSize: 11 }}
              />
              <ZAxis
                type="number"
                dataKey="z"
                range={[30, 350]}
                name="Капитализация"
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="chart-tooltip">
                      <b>{d.ticker}</b>
                      <div>P/E {number(d.x)}</div>
                      <div>EBITDA / cap {number(d.y)}%</div>
                      <div>${compact(d.z)}</div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={visibleScatter}
                fill={colors[1]}
                isAnimationActive={false}
              >
                {visibleScatter.map((s) => (
                  <Cell
                    key={s.ticker}
                    fill={
                      colors[
                        Math.max(
                          0,
                          sectors.findIndex((x) => x.name === s.sector),
                        ) % colors.length
                      ]
                    }
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </Chart>
          <p className="chart-footnote">
            {visibleScatter.length} из {scatter.length} точек в выбранном
            диапазоне. Отрицательный P/E и отсутствующие метрики исключены.
            Межотраслевое сравнение требует контекста.
          </p>
        </ChartPanel>
      </div>
      <ChartPanel
        title="Профиль крупнейших отраслей"
        note="Медиана положительных P/E и покрытие исходных значений. Данные доступны также в таблице."
      >
        <Chart
          label="Медиана положительных P/E по крупнейшим отраслям"
          height={390}
        >
          <BarChart
            data={sectors.slice(0, 12)}
            layout="vertical"
            margin={{ left: 0, right: 15 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="name"
              type="category"
              interval={0}
              width={135}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) =>
                String(v).length > 23 ? String(v).slice(0, 22) + "…" : String(v)
              }
            />
            <Tooltip formatter={(v) => [number(Number(v)), "Медиана P/E"]} />
            <Bar
              dataKey="medianPe"
              fill={colors[1]}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </Chart>
        <details>
          <summary>Таблица всех отраслей и покрытия</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Сектор</th>
                  <th>Компаний</th>
                  <th>Капитализация</th>
                  <th>Медиана P/E</th>
                  <th>P/E &gt; 0</th>
                </tr>
              </thead>
              <tbody>
                {sectors.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>{s.count}</td>
                    <td>${compact(s.cap)}</td>
                    <td>{number(s.medianPe)}</td>
                    <td>
                      {s.peCount} / {s.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </ChartPanel>
      <section className="panel">
        <div className="chart-heading">
          <h2>От графика к исследованию</h2>
          <Link className="text-link" href="/explore">
            Полный скринер →
          </Link>
        </div>
        <div className="ticker-cards">
          {leaders.map((c) => (
            <Link
              href={`/company/${c.ticker}`}
              className="ticker-card"
              key={c.ticker}
            >
              <strong>{c.ticker}</strong>
              <span>{c.name}</span>
              <small>
                P/E {number(c.pe)} · ${compact(c.marketCap)}
              </small>
            </Link>
          ))}
        </div>
        {!leaders.length && <p>Компании не найдены. Измените фильтр.</p>}
      </section>
    </>
  );
}

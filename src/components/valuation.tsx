"use client";
import { useState } from "react";
import { DcfCharts } from "./market/lazy-research";
import { useAuth } from "./auth/provider";
import { cloudSave, cloudResearch } from "@/lib/cloud-client";
import {
  RotateCcw,
  Bookmark,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import type { Assumptions } from "@/lib/types";
import { dcf, reverseDcf, sensitivity, scenarios } from "@/lib/finance";
import { number, usd, pct } from "@/lib/format";
import { Badge, Notice } from "./ui";
export function Valuation({
  initial,
  ticker,
}: {
  initial: Assumptions;
  ticker: string;
}) {
  const { user, configured } = useAuth();
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState(initial),
    [price, setPrice] = useState(""),
    [message, setMessage] = useState("");
  let result: ReturnType<typeof dcf> | null = null,
    error = "";
  try {
    result = dcf(a);
  } catch (e) {
    error = e instanceof Error ? e.message : "Некорректные параметры";
  }
  const implied = result && price ? reverseDcf(a, Number(price)) : null;
  async function save() {
    setBusy(true);
    try {
      if (user && configured) {
        await cloudSave({ operation: "valuation", ticker, assumptions: a });
        setMessage("Сценарий сохранён в облаке");
        return;
      }
      localStorage.setItem(
        `mirror-x-model-${ticker}`,
        JSON.stringify({
          ticker,
          assumptions: a,
          savedAt: new Date().toISOString(),
          status: "SANDBOX",
        }),
      );
      setMessage("Сценарий сохранён в этом браузере");
    } catch {
      setMessage("Не удалось сохранить сценарий");
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    setBusy(true);
    try {
      if (user && configured) {
        const rows = await cloudResearch(ticker);
        if (!rows[0]?.assumptions) {
          setMessage("В облаке пока нет сохранённого сценария");
          return;
        }
        dcf(rows[0].assumptions);
        setA(rows[0].assumptions);
        setMessage("Облачный сценарий восстановлен");
        return;
      }
      const raw = localStorage.getItem(`mirror-x-model-${ticker}`);
      if (!raw) {
        setMessage("Сохранённого сценария пока нет");
        return;
      }
      const next = JSON.parse(raw).assumptions;
      dcf(next);
      setA(next);
      setMessage("Сохранённый сценарий восстановлен");
    } catch {
      setMessage("Сохранённый сценарий повреждён или недоступен");
    } finally {
      setBusy(false);
    }
  }
  const fields: {
    key: keyof Assumptions;
    label: string;
    min: number;
    max: number;
    step: number;
    hint: string;
  }[] = [
    {
      key: "growth",
      label: "Рост выручки / год",
      min: -10,
      max: 25,
      step: 0.5,
      hint: "Аналитическое допущение на годы 1–5",
    },
    {
      key: "margin",
      label: "Операционная маржа",
      min: 1,
      max: 60,
      step: 0.5,
      hint: "Постоянная маржа прогнозного периода",
    },
    {
      key: "wacc",
      label: "WACC",
      min: 5,
      max: 18,
      step: 0.25,
      hint: "Сценарий, не оценка из рыночной beta",
    },
    {
      key: "terminalGrowth",
      label: "Терминальный рост",
      min: 0,
      max: 5,
      step: 0.25,
      hint: "Должен быть строго ниже WACC",
    },
    {
      key: "capexRate",
      label: "CapEx / выручка",
      min: 0,
      max: 15,
      step: 0.25,
      hint: "Прогнозные капитальные затраты",
    },
    {
      key: "daRate",
      label: "D&A / выручка",
      min: 0,
      max: 10,
      step: 0.25,
      hint: "Прогнозная амортизация",
    },
    {
      key: "nwcRate",
      label: "NWC / выручка",
      min: -10,
      max: 40,
      step: 1,
      hint: "ΔNWC = изменение выручки × доля NWC",
    },
    {
      key: "taxRate",
      label: "Налог на EBIT",
      min: 0,
      max: 40,
      step: 1,
      hint: "Нормализованная ставка прогнозного периода",
    },
  ];
  return (
    <>
      <Notice>
        Сценарии основаны на годовом отчёте и допущениях аналитика. Они не
        подтверждают текущую недооценку.{" "}
        {ticker === "PYPL" &&
          "Для PayPal FCFF предварительный: BNPL и клиентские средства требуют отдельной нормализации."}
      </Notice>
      <div className="valuation-layout">
        <aside className="panel model-inputs">
          <div className="section-title">
            <h2>Драйверы модели</h2>
            <button
              className="icon-button"
              onClick={() => {
                setA(initial);
                setMessage("Параметры сброшены");
              }}
              aria-label="Сбросить допущения"
            >
              <RotateCcw size={18} aria-hidden="true" />
            </button>
          </div>
          <p className="footnote">
            Все ползунки — допущения, а не опубликованные факты.
          </p>
          {fields.map((f) => (
            <label className="slider-label" key={f.key}>
              <div>
                <span>{f.label}</span>
                <output>{pct(a[f.key] as number)}</output>
              </div>
              <input
                aria-label={f.label}
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={(a[f.key] as number) * 100}
                onChange={(e) =>
                  setA({ ...a, [f.key]: Number(e.target.value) / 100 })
                }
              />
              <small>{f.hint}</small>
            </label>
          ))}
          <button className="button" onClick={save} disabled={!result || busy}>
            <Bookmark size={16} aria-hidden="true" />
            Сохранить сценарий
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={restore}
          >
            Восстановить сохранённый
          </button>
          <p role="status" className="footnote">
            {message}
          </p>
        </aside>
        <div className="model-output">
          {error ? (
            <div className="notice" role="alert">
              {error}
            </div>
          ) : (
            result && (
              <>
                <div className="value-summary">
                  <div>
                    <Badge tone="navy">SANDBOX · FCFF DCF</Badge>
                    <h2>Условная стоимость за акцию</h2>
                    <strong data-testid="fair-value">
                      {usd(result.fairValue)}
                    </strong>
                    <p>На базе выбранного годового периода · USD/share</p>
                  </div>
                  <div>
                    <span>Модельная стоимость через 12 месяцев</span>
                    <b>{usd(result.target12m)}</b>
                    <small>
                      EV × (1 + WACC) − FCFF₁ − net debt; затем / shares
                    </small>
                  </div>
                </div>
                <div className="scenario-grid">
                  {scenarios(a).map((s, i) => (
                    <article
                      className={`scenario-card scenario-${i}`}
                      key={s.name}
                    >
                      <div>
                        {i === 0 ? (
                          <ArrowDownRight size={18} aria-hidden="true" />
                        ) : (
                          <ArrowUpRight size={18} aria-hidden="true" />
                        )}
                        <span>{s.name}</span>
                      </div>
                      <strong>{usd(s.fairValue)}</strong>
                      <small>
                        {s.error
                          ? "Неприменимый сценарий"
                          : "Стоимость сегодня в модели"}
                      </small>
                      <p>
                        Рост {pct(s.assumptions.growth)} · маржа{" "}
                        {pct(s.assumptions.margin)}
                        <br />
                        WACC {pct(s.assumptions.wacc)}
                      </p>
                    </article>
                  ))}
                </div>
                <DcfCharts assumptions={a} />
                <article className="panel">
                  <h2>Какие ожидания заложены в цене?</h2>
                  <p>
                    Введите цену для собственного эксперимента. Она не станет
                    подтверждённой котировкой и не изменит конкурсный snapshot.
                  </p>
                  <label className="price-input">
                    Цена за акцию, USD
                    <input
                      aria-label="Цена для Reverse DCF"
                      type="number"
                      min="0.01"
                      max="1000000"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Введите цену"
                    />
                  </label>
                  <div className="reverse-output">
                    <span>Требуемый ежегодный рост выручки</span>
                    <strong>{implied === null ? "N/A" : pct(implied)}</strong>
                  </div>
                  <small>
                    {implied === null
                      ? "Без цены или при отсутствии корня в диапазоне −45%…+50% результат не вычисляется."
                      : "Остальные допущения фиксированы. Это объяснение цены, а не прогноз."}
                  </small>
                </article>
                <article className="panel">
                  <div className="section-title">
                    <h2>Чувствительность стоимости</h2>
                    <span className="muted">USD / акция</span>
                  </div>
                  <p className="footnote">
                    Строки: WACC · столбцы: terminal growth.
                  </p>
                  <div className="table-wrap">
                    <table className="heatmap">
                      <thead>
                        <tr>
                          <th>WACC / g</th>
                          {[-0.01, -0.005, 0, 0.005, 0.01].map((g) => (
                            <th key={g}>{pct(a.terminalGrowth + g)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sensitivity(a).map((row, i) => (
                          <tr key={i}>
                            <th>{pct(row.wacc)}</th>
                            {row.values.map((v, j) => (
                              <td
                                className={
                                  i === 2 && j === 2 ? "heat-center" : ""
                                }
                                key={j}
                              >
                                {v === null ? "N/A" : number(v, 1)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
                <article className="panel">
                  <h2>От выручки к денежному потоку</h2>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Млн USD</th>
                          {result.years.map((y) => (
                            <th key={y.year}>Год {y.year}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            "revenue",
                            "ebit",
                            "nopat",
                            "da",
                            "capex",
                            "deltaNwc",
                            "fcff",
                            "pv",
                          ] as const
                        ).map((k, i) => (
                          <tr key={k}>
                            <th>
                              {
                                [
                                  "Выручка",
                                  "EBIT",
                                  "NOPAT",
                                  "+ D&A",
                                  "− CapEx",
                                  "− ΔNWC",
                                  "FCFF",
                                  "PV(FCFF)",
                                ][i]
                              }
                            </th>
                            {result.years.map((y) => (
                              <td className="numeric" key={y.year}>
                                {number(y[k], 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="metric-line">
                    <span>Terminal value / EV</span>
                    <b>{pct(result.terminalShare)}</b>
                  </div>
                  {result.terminalShare > 0.7 && (
                    <p className="footnote warning">
                      Более 70% оценки приходится на terminal value. Проверьте
                      долгосрочные допущения.
                    </p>
                  )}
                  <p className="footnote">
                    Net debt {number(a.netDebt, 0)} млн USD · diluted shares{" "}
                    {number(a.shares)} млн. Нет прогнозных buybacks, дивидендов
                    или изменений долга; это ограничения модели.
                  </p>
                </article>
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}

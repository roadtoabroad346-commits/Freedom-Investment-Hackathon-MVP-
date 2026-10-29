import Link from "next/link";
import { Download, ShieldAlert, ArrowUpRight } from "lucide-react";
import { getDataset, getPublishedSnapshot } from "@/lib/repository";

import { allocate } from "@/lib/finance";
import { focusResearch } from "@/lib/research";
import { usd, pct } from "@/lib/format";
import { Badge, PageHead, Notice, Source, SectionTitle } from "./ui";
export async function Contest({ jury = false }: { jury?: boolean }) {
  const [{ universe }, snapshot] = await Promise.all([
    getDataset(),
    getPublishedSnapshot(),
  ]);
  const allocation = allocate(snapshot.companies.map((c) => c.allocationBps));
  return (
    <>
      <PageHead
        eyebrow={
          jury
            ? "JURY MODE / READ-ONLY SNAPSHOT"
            : "FREEDOM INVESTMENT CHALLENGE 2026"
        }
        title={
          jury
            ? "Идея должна выдержать вопросы"
            : "Три исследования. Один портфель."
        }
        description="Учебный капитал $100 000 · горизонт 12 месяцев · отдельный конкурсный сценарий MIRROR X."
        action={
          <Badge tone="amber">{snapshot.status} · НЕ ГОТОВО К СДАЧЕ</Badge>
        }
      />
      <Notice>
        <strong>Цены закрытия 2 ноября 2026 ещё не зафиксированы.</strong> Ни
        один кандидат пока не подтверждён как Buy. Модельные target и веса —
        рабочие допущения; таблица не является финальной рекомендацией.
      </Notice>
      <div className="contest-banner">
        <ShieldAlert size={24} aria-hidden="true" />
        <p>
          <strong>Дедлайн: 3 ноября 2026, 23:59 UTC+5.</strong>
          <br />
          Требования проверены по всем 6 страницам официального PDF. На первом
          слайде — сводная таблица; всего 14 основных слайдов.{" "}
          {jury
            ? "Это неизменяемый предварительный срез."
            : "Конкурсные фильтры не меняют общий Explorer."}
        </p>
      </div>
      <div className="funnel">
        {[
          {
            v: String(universe.length),
            label: "Импортировано компаний",
            s: "Общий исследовательский universe",
          },
          {
            v: "0",
            label: "Подтверждено contest PASS",
            s: "Нет цены на 02.11 и проверок ликвидности",
          },
          {
            v: String(snapshot.companies.length),
            label: "Основных исследований",
            s: "Adobe / PayPal / Nike — кандидаты",
          },
          {
            v: "0",
            label: "Подтверждено Buy",
            s: "Решение аналитика ещё не принято",
          },
        ].map((s) => (
          <div key={s.label}>
            <small>{s.label}</small>
            <strong>{s.v}</strong>
            <span>{s.s}</span>
          </div>
        ))}
      </div>
      <SectionTitle
        title="Сводка исследовательских кандидатов"
        aside={<span>Условные веса · не исполненные сделки</span>}
      />
      <div className="table-wrap contest-summary">
        <table>
          <thead>
            <tr>
              <th>Компания</th>
              <th>Статус</th>
              <th>Close 02.11</th>
              <th>Target 12m*</th>
              <th>Upside</th>
              <th>Доля</th>
              <th>Капитал</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.companies.map((c, i) => (
              <tr key={c.ticker}>
                <td>
                  <Link href={`/company/${c.ticker}`}>
                    <b>{c.ticker}</b>
                    <br />
                    {c.name}
                  </Link>
                </td>
                <td>
                  <Badge>{c.recommendation}</Badge>
                </td>
                <td>{usd(c.price)}</td>
                <td className="numeric">{usd(c.target12m)}</td>
                <td>{pct(c.upside)}</td>
                <td>{pct(c.allocationBps / 10000)}</td>
                <td>{usd(allocation[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        * Target из модели на базе указанного годового периода. До обновления
        модели и фиксации рыночных данных не является конкурсным target на
        02.11.2026. Fair value и target разделены. Предварительные веса 40/35/25
        — аналитическое допущение.
      </p>
      <div className="downloads">
        <a className="button" href="/api/export/xlsx">
          <Download size={17} aria-hidden="true" />
          Модель Excel · PRELIMINARY
        </a>
        <a className="button secondary" href="/api/export/pptx">
          <Download size={17} aria-hidden="true" />
          Презентация · PRELIMINARY
        </a>
        <a className="button secondary" href="/api/snapshot">
          JSON snapshot <ArrowUpRight size={16} aria-hidden="true" />
        </a>
        {!jury && (
          <Link href="/jury" className="button secondary">
            Режим жюри <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="two-col">
        <article className="panel">
          <h2>Распределение и общий риск</h2>
          <div
            className="allocation-bar"
            aria-label="Предварительные веса: Adobe 40%, PayPal 35%, Nike 25%"
          >
            {snapshot.companies.map((c) => (
              <span
                key={c.ticker}
                style={{ width: `${c.allocationBps / 100}%` }}
              />
            ))}
          </div>
          {focusResearch.map((r) => (
            <p key={r.ticker}>
              <strong>{r.ticker}:</strong> {r.rationale}
            </p>
          ))}
          <p>
            <strong>Общая уязвимость:</strong> замедление потребителя и рост
            ставок могут одновременно снизить рост и оценки всех трёх. Три акции
            не означают полноценную диверсификацию.
          </p>
          <p className="footnote">
            Корреляции и ожидаемая доходность портфеля не рассчитаны: нет
            согласованной истории цен. Иностранные валюты, тарифы и AI влияют на
            компании по-разному.
          </p>
        </article>
        <article className="panel">
          <h2>Макро: факт и сценарий</h2>
          <p>
            <strong>28.10.2026:</strong> ФРС сохранила диапазон 3,75–4,00%. Это
            ставка денежной политики, а не risk-free yield для WACC.
          </p>
          <Source href="https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm">
            Официальное заявление FOMC
          </Source>
          <p className="footnote">
            PCE, ВВП и нефть из задания — исходные сценарные ориентиры кейса, а
            не независимо подтверждённые здесь рыночные факты.
          </p>
          <p>
            Выборы в Конгресс 3 ноября: неопределённость до дедлайна. Итоги не
            используются задним числом. WACC +1 п.п., снижение роста и маржи
            доступны в Valuation Studio.
          </p>
        </article>
      </div>
      <SectionTitle title="Проверка допуска по каждой компании" />
      <div className="three-col">
        {snapshot.companies.map((c) => (
          <article className="panel" key={c.ticker}>
            <h2>{c.ticker}</h2>
            {c.gates.map((g) => (
              <div className="gate" key={g.name}>
                <Badge tone={g.status === "PASS" ? "green" : "amber"}>
                  {g.status}
                </Badge>
                <span>
                  <b>{g.name}</b>
                  <small>{g.reason}</small>
                </span>
              </div>
            ))}
            <p className="footnote">
              Подтверждение аналитика: нет.
              <br />
              Технический анализ: нет датированной OHLCV.
            </p>
            <Link href={`/company/${c.ticker}`} className="text-link">
              Исследовать <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
      <article className="panel">
        <h2>Что препятствует статусу FINAL</h2>
        <ol>
          {snapshot.blockers.map((b) => (
            <li key={b}>
              <p>{b}</p>
            </li>
          ))}
        </ol>
        <p className="snapshot-id">
          {snapshot.id} · {snapshot.generatedAt}
          <br />
          model: {snapshot.modelVersion} · score: {snapshot.scoreVersion}
          <br />
          SHA256 inputs: {snapshot.sourceHash}
        </p>
      </article>
    </>
  );
}

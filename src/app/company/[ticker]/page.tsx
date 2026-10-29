import Link from "next/link";
import { FundamentalCharts } from "@/components/market/lazy-research";
import { notFound } from "next/navigation";
import { ArrowUpRight, Download, ShieldAlert, ArrowLeft } from "lucide-react";
import { getDataset } from "@/lib/repository";
export const dynamic = "force-dynamic";
import { focusResearch } from "@/lib/research";
import { scoreCompany } from "@/lib/screening";
import { number, pct, compact, usd } from "@/lib/format";
import {
  Badge,
  PageHead,
  Stat,
  Notice,
  Source,
  SectionTitle,
  ButtonLink,
} from "@/components/ui";
import { WatchButton } from "@/components/watch";
import { dcf } from "@/lib/finance";
export default async function Company({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { getCompany, annualFacts, universe, getModel } = await getDataset();
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase(),
    c = getCompany(ticker);
  if (!c) notFound();
  const f = annualFacts[ticker],
    r = focusResearch.find((r) => r.ticker === ticker),
    s = scoreCompany(c, universe),
    model = getModel(ticker);
  return (
    <>
      <Link href="/explore" className="text-link back-link">
        <ArrowLeft size={15} aria-hidden="true" /> Компании
      </Link>
      <PageHead
        eyebrow={`${c.sector} / COMPANY RESEARCH`}
        title={`${c.ticker} · ${c.name}`}
        description="Факты, гипотезы и неопределённость — раздельно."
        action={<WatchButton ticker={ticker} />}
      />
      <div className="company-actions">
        <Badge tone="amber">
          {f ? "Годовой отчёт · PROVISIONAL" : c.quality}
        </Badge>
        <span className="muted">
          {f
            ? `Период до ${f.periodEnd} · документ ${f.filedAt}`
            : "Дата финансового набора не подтверждена"}
        </span>
        <a className="button secondary" href={`/api/company/${ticker}/brief`}>
          <Download size={16} aria-hidden="true" />
          Research brief
        </a>
        {model && (
          <ButtonLink href={`/valuation/${ticker}`}>
            Оценить компанию
          </ButtonLink>
        )}
      </div>
      <Notice>
        Датированной рыночной цены нет: upside и рекомендация Buy не
        вычисляются.{" "}
        {f
          ? "Годовые данные проверены по указанному документу; обновление до последних кварталов ещё требуется."
          : "Факты из общего набора не имеют подтверждённого периода. Стандартная DCF без достаточных исходных данных недоступна."}
      </Notice>
      <div className="stats-row">
        {f ? (
          <>
            <Stat
              label="Выручка, млн USD"
              value={number(f.revenue, 0)}
              note={`FY до ${f.periodEnd}`}
            />
            <Stat
              label="Рост выручки FY/FY"
              value={pct(f.revenue / f.priorRevenue - 1)}
              note="Сравнение годовых периодов"
            />
            <Stat
              label="Операционная маржа"
              value={pct(f.operatingIncome / f.revenue)}
              note="Operating income / Revenue"
            />
            <Stat
              label="Разводнённые акции, млн"
              value={number(f.dilutedShares, 1)}
              note="Средневзвешенные за год"
            />
          </>
        ) : (
          <>
            <Stat
              label="P/E из набора"
              value={number(c.pe)}
              note="Период не подтверждён"
            />
            <Stat
              label="Капитализация из набора"
              value={`$${compact(c.marketCap)}`}
              note="Не на 02.11.2026"
            />
            <Stat
              label="EBITDA из набора"
              value={`$${compact(c.ebitda)}`}
              note="Не денежный поток"
            />
            <Stat
              label="Цена из набора"
              value={usd(c.price)}
              note="UNDATED · не текущая цена"
            />
          </>
        )}
      </div>
      {f && <FundamentalCharts fact={f} ticker={ticker} />}
      <div className="toolbar">
        <Link className="button secondary" href="/workspace">
          Загрузить котировки и построить график
        </Link>
        <Link className="text-link" href="/market">
          Обзор рынка →
        </Link>
      </div>
      {r ? (
        <>
          <div className="two-col">
            <article className="panel">
              <span className="mini-label">БИЗНЕС И ПРЕИМУЩЕСТВО</span>
              <h2>За что платят клиенты</h2>
              <p>{r.business}</p>
              <p>{r.moat}</p>
              <Source href={r.sourceUrl}>Годовой отчёт · бизнес и риски</Source>
            </article>
            <article className="panel thesis-panel">
              <span className="mini-label">
                АНАЛИТИЧЕСКАЯ ГИПОТЕЗА · НЕ ФАКТ
              </span>
              <h2>Что может упускать рынок</h2>
              <p>{r.thesis}</p>
              <Badge tone="amber">NOT-RATED · требуется проверка</Badge>
            </article>
          </div>
          <div className="two-col">
            <article className="panel">
              <SectionTitle
                title="Финансовая история"
                aside={<span className="muted">млн USD · FY</span>}
              />
              <div
                className="history-chart"
                role="img"
                aria-label={f.history
                  .map(
                    (h) =>
                      `${h.year}: выручка ${h.revenue}, операционная прибыль ${h.operatingIncome} млн USD`,
                  )
                  .join("; ")}
              >
                {f.history.map((h) => (
                  <div className="history-group" key={h.year}>
                    <span>{number(h.revenue, 0)}</span>
                    <div className="history-bars">
                      <i
                        style={{
                          height: Math.round(
                            (h.revenue /
                              Math.max(...f.history.map((v) => v.revenue))) *
                              145,
                          ),
                        }}
                      />
                      <i
                        style={{
                          height: Math.round(
                            (h.operatingIncome /
                              Math.max(...f.history.map((v) => v.revenue))) *
                              145,
                          ),
                        }}
                      />
                    </div>
                    <b>FY{h.year}</b>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <span>
                  <i />
                  Выручка
                </span>
                <span>
                  <i />
                  Операционная прибыль
                </span>
              </div>
              <Source href={f.sourceUrl}>Consolidated income statement</Source>
            </article>
            <article className="panel risk-panel">
              <div className="risk-title">
                <ShieldAlert size={21} aria-hidden="true" />
                <h2>Почему рынок может быть прав</h2>
              </div>
              <p>{r.contra}</p>
              <h3>Как опровергнуть гипотезу</h3>
              {r.risks.map((v) => (
                <p key={v.name}>
                  <strong>{v.name}:</strong> {v.trigger}
                </p>
              ))}
            </article>
          </div>
          <SectionTitle title="Макро → бизнес → оценка" />
          <div className="three-col">
            {r.macro.map((m, i) => (
              <article className="panel macro-card" key={m}>
                <span className="mini-label">КАНАЛ ВЛИЯНИЯ / 0{i + 1}</span>
                <p>{m}</p>
              </article>
            ))}
          </div>
          <div className="two-col">
            <article className="panel">
              <h2>Катализаторы для проверки</h2>
              {r.catalysts.map((v) => (
                <div className="list-item" key={v.event}>
                  <strong>{v.event}</strong>
                  <small>{v.window}</small>
                  <p>{v.evidence}</p>
                </div>
              ))}
            </article>
            <article className="panel">
              <h2>Риски: вероятность и эффект</h2>
              {r.risks.map((v) => (
                <div className="list-item" key={v.name}>
                  <strong>{v.name}</strong>
                  <small>{v.probability}</small>
                  <p>{v.impact}</p>
                </div>
              ))}
            </article>
          </div>
          {model && (
            <div className="valuation-teaser">
              <div>
                <span className="mini-label">
                  УСЛОВНАЯ ОЦЕНКА НА БАЗЕ ГОДОВОГО ОТЧЁТА
                </span>
                <h2>
                  {usd(dcf(model).fairValue)} <small>за акцию</small>
                </h2>
                <p>
                  DCF с явными аналитическими допущениями. Рыночная цена для
                  сравнения отсутствует.
                </p>
              </div>
              <ButtonLink href={`/valuation/${ticker}`}>
                Открыть модель
              </ButtonLink>
            </div>
          )}
        </>
      ) : (
        <article className="panel">
          <h2>Исследование доступно без готовой DCF</h2>
          <p>
            Для {ticker} загружены метрики общего набора. Чтобы строить FCFF
            DCF, нужны валидированные выручка, операционная маржа, реинвестиции,
            долг и разводнённые акции за согласованный период.
          </p>
          <p>
            {s.reason}. Для банков и страховщиков требуется отдельный метод
            оценки.
          </p>
          <Source href={c.sourceUrl}>Исходный набор</Source>
        </article>
      )}
      <div className="two-col">
        <article className="panel">
          <h2>Объяснение рейтинга</h2>
          <div className="score-breakdown">
            <strong>
              {s.score ?? "N/A"}
              <small>/ 100</small>
            </strong>
            <p>{s.reason}</p>
          </div>
          {s.score !== null && (
            <>
              <div className="metric-line">
                <span>P/E: отраслевой процентиль × 60%</span>
                <b>{number(s.peRank)}</b>
              </div>
              <div className="metric-line">
                <span>EBITDA / капитализация × 40%</span>
                <b>{number(s.cashRank)}</b>
              </div>
            </>
          )}
          <p className="footnote">
            Рейтинг не означает вероятность роста или готовую Buy-идею.
          </p>
        </article>
        <article className="panel">
          <h2>Evidence Ledger</h2>
          <div className="list-item">
            <Badge tone="navy">IMPORTED</Badge>
            <p>503 записи · общий набор · дата котировок отсутствует</p>
            <Source href={c.sourceUrl} />
          </div>
          {f && (
            <div className="list-item">
              <Badge tone="neutral">ANNUAL FACTS</Badge>
              <p>
                FY до {f.periodEnd} · USD millions · опубликовано {f.filedAt}
              </p>
              <Source href={f.sourceUrl} />
            </div>
          )}
          <p className="footnote">
            Технический анализ: нет датированной истории OHLCV. SMA50/SMA200,
            точки входа и выхода не подставляются.
          </p>
        </article>
      </div>
    </>
  );
}

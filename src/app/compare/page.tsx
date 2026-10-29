import Link from "next/link";
import { getCompany, annualFacts } from "@/lib/data";
import { PageHead, Notice, Source } from "@/components/ui";
import { number, pct, compact } from "@/lib/format";
export default async function Compare({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const tickers = [
    ...new Set(
      (p.tickers ?? "ADBE,PYPL,NKE")
        .toUpperCase()
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ].slice(0, 3);
  const companies = tickers.map(getCompany);
  return (
    <>
      <PageHead
        eyebrow="COMPARE"
        title="Сравните аргументы"
        description="До трёх произвольных тикеров. Различия периодов и отраслей всегда видны."
      />
      <form className="filter-panel">
        <label>
          Тикеры через запятую
          <input
            name="tickers"
            defaultValue={p.tickers ?? "ADBE,PYPL,NKE"}
            maxLength={40}
          />
        </label>
        <button className="button" type="submit">
          Сравнить
        </button>
      </form>
      <Notice>
        Годовые периоды различаются. Межотраслевое сравнение маржи и
        мультипликаторов само по себе не доказывает, что одна компания дешевле
        другой.
      </Notice>
      <div className="three-col">
        {companies.map((c, i) =>
          c ? (
            <article className="panel" key={c.ticker}>
              <Link href={`/company/${c.ticker}`}>
                <h2>
                  {c.ticker} · {c.name}
                </h2>
              </Link>
              <p>{c.sector}</p>
              {annualFacts[c.ticker] ? (
                (() => {
                  const f = annualFacts[c.ticker];
                  return (
                    <>
                      <div className="metric-line">
                        <span>Период FY</span>
                        <b>{f.periodEnd}</b>
                      </div>
                      <div className="metric-line">
                        <span>Выручка, млн USD</span>
                        <b>{number(f.revenue, 0)}</b>
                      </div>
                      <div className="metric-line">
                        <span>Рост год к году</span>
                        <b>{pct(f.revenue / f.priorRevenue - 1)}</b>
                      </div>
                      <div className="metric-line">
                        <span>Operating margin</span>
                        <b>{pct(f.operatingIncome / f.revenue)}</b>
                      </div>
                      <Source href={f.sourceUrl} />
                    </>
                  );
                })()
              ) : (
                <>
                  <div className="metric-line">
                    <span>P/E (UNDATED)</span>
                    <b>{number(c.pe)}</b>
                  </div>
                  <div className="metric-line">
                    <span>Капитализация (UNDATED)</span>
                    <b>${compact(c.marketCap)}</b>
                  </div>
                  <p>Годовой период не подтверждён. DCF недоступна.</p>
                  <Source href={c.sourceUrl} />
                </>
              )}
            </article>
          ) : (
            <article className="panel" key={tickers[i]}>
              <h2>{tickers[i]}</h2>
              <p>
                Тикер не найден в импортированной базе. Данные не выдумываются.
              </p>
            </article>
          ),
        )}
      </div>
    </>
  );
}

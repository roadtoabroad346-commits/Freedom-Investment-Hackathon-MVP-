import Link from "next/link";
import {
  Search,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import { screen } from "@/lib/screening";
import { universe, coverage } from "@/lib/data";
import { compact, number } from "@/lib/format";
import { Badge, PageHead, Notice, Source, Empty } from "@/components/ui";
export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const safe = (v: string | undefined) =>
    v !== undefined && v.trim() !== "" && Number.isFinite(Number(v))
      ? Number(v)
      : undefined;
  const f = {
    query: p.q,
    sector: p.sector,
    maxPe: safe(p.pe),
    minCap: safe(p.cap),
    positiveEbitda: p.ebitda === "1",
    datedOnly: p.dated === "1",
    sort: p.sort,
    page: safe(p.page),
  };
  const result = screen(universe, f);
  const sectors = [...new Set(universe.map((c) => c.sector))].sort();
  const pageUrl = (page: number) => {
    const s = new URLSearchParams(
      Object.entries(p).filter(
        (e): e is [string, string] => e[1] !== undefined,
      ),
    );
    s.set("page", String(page));
    return "/explore?" + s;
  };
  return (
    <>
      <PageHead
        eyebrow="UNIVERSE EXPLORER"
        title="Идея начинается с отбора"
        description="Ищите любую загруженную компанию. Конкурсные правила не ограничивают этот список."
        action={<Badge tone="navy">{coverage().instruments} компании</Badge>}
      />
      <Notice>
        Котировки общего набора — <strong>UNDATED</strong>: дата источником не
        указана. Рейтинг характеризует только импортированный набор, а не
        актуальную недооценку. Датированных котировок: {coverage().datedPrices}.
      </Notice>
      <form className="filter-panel" action="/explore">
        <div className="search-field">
          <Search size={20} aria-hidden="true" />
          <label className="sr-only" htmlFor="company-search">
            Тикер или название компании
          </label>
          <input
            id="company-search"
            name="q"
            defaultValue={p.q}
            placeholder="Найти тикер или компанию, например MSFT"
            maxLength={80}
          />
          <button className="button" type="submit">
            Найти <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="filter-row">
          <label>
            Отрасль
            <select name="sector" defaultValue={p.sector ?? ""}>
              <option value="">Все отрасли</option>
              {sectors.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Максимум P/E
            <select name="pe" defaultValue={p.pe ?? ""}>
              <option value="">Без ограничения</option>
              <option value="15">До 15×</option>
              <option value="25">До 25×</option>
              <option value="40">До 40×</option>
            </select>
          </label>
          <label>
            Капитализация набора
            <select name="cap" defaultValue={p.cap ?? ""}>
              <option value="">Любая</option>
              <option value="2000000000">От $2 млрд</option>
              <option value="100000000000">От $100 млрд</option>
            </select>
          </label>
          <label>
            Сортировка
            <select name="sort" defaultValue={p.sort ?? "ticker"}>
              <option value="ticker">По тикеру</option>
              <option value="score">По исследовательскому рейтингу</option>
              <option value="cap">По капитализации</option>
              <option value="pe">По P/E</option>
            </select>
          </label>
        </div>
        <div className="filter-bottom">
          <div className="checkboxes">
            <label>
              <input
                name="ebitda"
                type="checkbox"
                value="1"
                defaultChecked={p.ebitda === "1"}
              />{" "}
              Положительная EBITDA
            </label>
            <label>
              <input
                name="dated"
                type="checkbox"
                value="1"
                defaultChecked={p.dated === "1"}
              />{" "}
              Только цены с датой
            </label>
          </div>
          <div className="button-group">
            <Link className="text-link" href="/explore">
              Сбросить
            </Link>
            <button type="submit" className="button secondary">
              <SlidersHorizontal size={16} aria-hidden="true" /> Применить
            </button>
          </div>
        </div>
      </form>
      <div className="results-heading">
        <strong data-testid="result-count">Найдено: {result.total}</strong>
        <span>
          Страница {result.page} · по {result.pageSize} компаний
        </span>
        <a className="text-link" href="/api/screen?pageSize=100">
          Открыть API <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
      {result.rows.length ? (
        <div className="table-wrap">
          <table className="company-table">
            <thead>
              <tr>
                <th>Компания</th>
                <th>Отрасль</th>
                <th>P/E набора</th>
                <th>Капитализация</th>
                <th>Рейтинг*</th>
                <th>Данные</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((c) => (
                <tr key={c.ticker}>
                  <td>
                    <Link
                      href={`/company/${c.ticker}`}
                      className="company-cell"
                    >
                      <span className="ticker-mini">
                        {c.ticker.slice(0, 2)}
                      </span>
                      <span>
                        <b>{c.ticker}</b>
                        <small>{c.name}</small>
                      </span>
                    </Link>
                  </td>
                  <td>{c.sector}</td>
                  <td className="numeric">
                    {c.pe !== null && c.pe > 0 ? `${number(c.pe)}×` : "—"}
                  </td>
                  <td className="numeric">${compact(c.marketCap)}</td>
                  <td>
                    <span className="score" title={c.reason}>
                      {c.score ?? "N/A"}
                      {c.score !== null && (
                        <i style={{ width: `${c.score}%` }} />
                      )}
                    </span>
                  </td>
                  <td>
                    <Badge tone="amber">{c.quality}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="По этим условиям нет компаний">
          Снимите один из фильтров. Если выбраны датированные котировки, сначала
          импортируйте проверенные данные.
        </Empty>
      )}
      <div className="pagination">
        {result.page > 1 ? (
          <Link href={pageUrl(result.page - 1)} className="button secondary">
            <ArrowLeft size={16} aria-hidden="true" /> Назад
          </Link>
        ) : (
          <span />
        )}
        <span>
          {Math.min((result.page - 1) * 25 + 1, result.total)}–
          {Math.min(result.page * 25, result.total)} из {result.total}
        </span>
        {result.page * 25 < result.total ? (
          <Link href={pageUrl(result.page + 1)} className="button secondary">
            Далее <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <span />
        )}
      </div>
      <p className="footnote">
        * Отраслевые процентили: 60% обратный P/E, 40% EBITDA / капитализация.
        Не FCF yield и не EV/EBITDA. Минимум 5 сопоставимых компаний; банки,
        страховщики и REIT исключены из этой модели рейтинга.{" "}
        <Source href="https://github.com/datasets/s-and-p-500-companies-financials">
          Источник набора
        </Source>
      </p>
    </>
  );
}

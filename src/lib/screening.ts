import type { Instrument, Gate } from "./types";
export const SCORE_VERSION = "sector-value-v1";
const financialSector =
  /bank|insurance|financial|capital markets|mortgage|reit|consumer finance/i;
export function scoreCompany(c: Instrument, all: Instrument[]) {
  if (financialSector.test(c.sector))
    return {
      score: null,
      peRank: null,
      cashRank: null,
      reason: "Нужна отраслевая модель: EBITDA-мультипликатор неприменим",
      peerCount: 0,
    };
  if (
    c.pe === null ||
    c.pe <= 0 ||
    c.ebitda === null ||
    c.ebitda <= 0 ||
    c.marketCap === null ||
    c.marketCap <= 0
  )
    return {
      score: null,
      peRank: null,
      cashRank: null,
      reason: "Недостаточно положительных исходных метрик",
      peerCount: 0,
    };
  const peers = all.filter(
    (p) =>
      p.sector === c.sector &&
      p.pe !== null &&
      p.pe > 0 &&
      p.ebitda !== null &&
      p.ebitda > 0 &&
      p.marketCap !== null &&
      p.marketCap > 0,
  );
  if (peers.length < 5)
    return {
      score: null,
      peRank: null,
      cashRank: null,
      reason: "Менее 5 сопоставимых компаний: рейтинг не вычислен",
      peerCount: peers.length,
    };
  const percentile = (value: number, values: number[], lowerBetter = false) =>
    (100 *
      (values.filter((x) => (lowerBetter ? x > value : x < value)).length +
        0.5 * values.filter((x) => x === value).length)) /
    values.length;
  const peRank = percentile(
      c.pe,
      peers.map((p) => p.pe!),
      true,
    ),
    cashRank = percentile(
      c.ebitda / c.marketCap,
      peers.map((p) => p.ebitda! / p.marketCap!),
    );
  return {
    score: Math.round(0.6 * peRank + 0.4 * cashRank),
    peRank,
    cashRank,
    peerCount: peers.length,
    reason: `60% P/E + 40% EBITDA / капитализация; ${peers.length} отраслевых аналогов. Дата набора не подтверждена.`,
  };
}
export type ScreenFilters = {
  query?: string;
  sector?: string;
  maxPe?: number;
  minCap?: number;
  positiveEbitda?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
  datedOnly?: boolean;
};
export function screen(all: Instrument[], f: ScreenFilters = {}) {
  const q = (f.query ?? "").trim().toLowerCase();
  const scored = all.map((c) => ({ ...c, ...scoreCompany(c, all) }));
  const rows = scored.filter(
    (c) =>
      (!q ||
        c.ticker.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)) &&
      (!f.sector || c.sector === f.sector) &&
      (f.maxPe === undefined ||
        (c.pe !== null && c.pe > 0 && c.pe <= f.maxPe)) &&
      (f.minCap === undefined ||
        (c.marketCap !== null && c.marketCap >= f.minCap)) &&
      (!f.positiveEbitda || (c.ebitda !== null && c.ebitda > 0)) &&
      (!f.datedOnly || c.priceAsOf !== null),
  );
  const sort = f.sort ?? "ticker";
  rows.sort((a, b) =>
    sort === "score"
      ? (b.score ?? -1) - (a.score ?? -1) || a.ticker.localeCompare(b.ticker)
      : sort === "cap"
        ? (b.marketCap ?? -1) - (a.marketCap ?? -1) ||
          a.ticker.localeCompare(b.ticker)
        : sort === "pe"
          ? (a.pe && a.pe > 0 ? a.pe : Infinity) -
              (b.pe && b.pe > 0 ? b.pe : Infinity) ||
            a.ticker.localeCompare(b.ticker)
          : a.ticker.localeCompare(b.ticker),
  );
  const page = Math.max(1, f.page ?? 1),
    size = Math.min(100, Math.max(1, f.pageSize ?? 25));
  return {
    total: rows.length,
    page,
    pageSize: size,
    rows: rows.slice((page - 1) * size, page * size),
  };
}
export function eligibility(c: Instrument, asOf = "2026-11-02"): Gate[] {
  const numeric = (
    name: string,
    x: number | null,
    threshold: number,
  ): Gate => ({
    name,
    status: x === null ? "REVIEW" : x >= threshold ? "PASS" : "FAIL",
    reason:
      x === null
        ? "Нет подтверждённых данных"
        : `${x.toLocaleString("en-US")} / минимум ${threshold.toLocaleString("en-US")}`,
  });
  return [
    {
      name: "Биржа и инструмент",
      status:
        c.exchange === null || c.assetType === "UNKNOWN"
          ? "REVIEW"
          : ["NYSE", "NASDAQ"].includes(c.exchange) &&
              ["COMMON", "ADR"].includes(c.assetType)
            ? "PASS"
            : "FAIL",
      reason: c.exchange ?? "Биржа и тип требуют проверки",
    },
    {
      name: "Цена и капитализация на 02.11",
      status:
        c.priceAsOf !== asOf
          ? "REVIEW"
          : c.price !== null && c.marketCap !== null && c.marketCap >= 2e9
            ? "PASS"
            : "FAIL",
      reason:
        c.priceAsOf === asOf
          ? "Проверить close, shares и источник"
          : "Нет regular close и капитализации на конкурсную дату",
    },
    numeric("Оборот USD, средний за 3 месяца", c.avgDollarVolume, 3e6),
    numeric("История торгов, лет", c.historyYears, 3),
    {
      name: "Запрещённые отрасли",
      status:
        c.restrictedRevenueShare === null
          ? "REVIEW"
          : c.restrictedRevenueShare > 0.5
            ? "FAIL"
            : "PASS",
      reason:
        c.restrictedRevenueShare === null
          ? "Проверить преобладающую долю выручки по сегментам"
          : "Доля выручки запрещённых направлений проверена",
    },
  ];
}

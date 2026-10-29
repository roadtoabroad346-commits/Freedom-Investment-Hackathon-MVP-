export const number = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined
    ? "—"
    : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(
        x,
      );
export const usd = (x: number | null | undefined) =>
  x === null || x === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(x);
export const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? "—" : `${number(x * 100, 1)}%`;
export const compact = (x: number | null | undefined) =>
  x === null || x === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(x);

import type { CloudResearch } from "./research-schema";
import type { Assumptions } from "./types";
async function jsonRequest(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(15000),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Сервис вернул некорректный ответ");
  }
  if (!response.ok) throw new Error(result.error ?? "Запрос не выполнен");
  return result;
}
export async function cloudResearch(ticker?: string): Promise<CloudResearch[]> {
  const x = await jsonRequest(
    "/api/research" + (ticker ? "?ticker=" + encodeURIComponent(ticker) : ""),
  );
  return x.items;
}
export async function cloudSave(
  input:
    | { operation: "watch"; ticker: string }
    | { operation: "note"; ticker: string; note: string }
    | { operation: "valuation"; ticker: string; assumptions: Assumptions }
    | {
        operation: "import";
        ticker: string;
        note: string;
        assumptions?: Assumptions;
      },
): Promise<CloudResearch> {
  const x = await jsonRequest("/api/research", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!x.item) throw new Error("Сохранение не подтверждено сервером");
  return x.item;
}
export async function cloudDelete(ticker: string) {
  await jsonRequest("/api/research", {
    method: "DELETE",
    body: JSON.stringify({ ticker }),
  });
}

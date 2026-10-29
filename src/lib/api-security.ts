import { NextResponse } from "next/server";
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};
export function apiError(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: privateHeaders },
  );
}
export function mutationGuard(req: Request) {
  const origin = req.headers.get("origin"),
    site = new URL(req.url).origin;
  if (!origin || origin !== site)
    return apiError("Запрос должен исходить с этого сайта", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return apiError("Нужен JSON", 415);
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 20000) return apiError("Запрос слишком большой", 413);
  return null;
}
export async function readSmallJson(req: Request) {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > 20000)
    throw new Error("Запрос слишком большой");
  return JSON.parse(text) as unknown;
}

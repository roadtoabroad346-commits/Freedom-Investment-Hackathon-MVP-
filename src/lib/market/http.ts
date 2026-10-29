import {
  apiError,
  privateHeaders,
  requestOriginMatches,
} from "../api-security";
export { apiError, privateHeaders };
export function sameOrigin(req: Request) {
  return requestOriginMatches(req)
    ? null
    : apiError("Запрос должен исходить с этого сайта", 403);
}
export async function readBounded(req: Request, max: number) {
  if (Number(req.headers.get("content-length") ?? 0) > max)
    throw new Error("Превышен размер запроса");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Пустой запрос");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new Error("Превышен размер запроса");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

import { cloudConfigured } from "@/lib/supabase/config";
import { requestSupabase } from "@/lib/supabase/server";
import { researchWriteSchema, tickerSchema } from "@/lib/research-schema";
import {
  privateHeaders,
  apiError,
  mutationGuard,
  readSmallJson,
} from "@/lib/api-security";
import { dcf } from "@/lib/finance";
export const dynamic = "force-dynamic";
async function authenticated() {
  if (!cloudConfigured())
    return {
      error: apiError("Облачное сохранение не подключено", 503),
    } as const;
  const client = await requestSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    return {
      error: apiError("Войдите, чтобы сохранять исследования в облаке", 401),
    } as const;
  return { client, user: data.user } as const;
}
export async function GET(req: Request) {
  try {
    const auth = await authenticated();
    if ("error" in auth) return auth.error;
    const ticker = new URL(req.url).searchParams.get("ticker");
    if (ticker && !tickerSchema.safeParse(ticker).success)
      return apiError("Некорректный тикер");
    let q = auth.client
      .from("mx_research")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (ticker) q = q.eq("ticker", ticker);
    const { data, error } = await q;
    if (error) return apiError("Не удалось загрузить исследования", 503);
    return Response.json({ items: data }, { headers: privateHeaders });
  } catch {
    return apiError("Сервис исследований временно недоступен", 503);
  }
}
export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;
  try {
    const auth = await authenticated();
    if ("error" in auth) return auth.error;
    const parsed = researchWriteSchema.safeParse(await readSmallJson(req));
    if (!parsed.success)
      return apiError("Проверьте тикер, длину заметки и параметры модели");
    const p = parsed.data;
    if (
      (p.operation === "valuation" || p.operation === "import") &&
      p.assumptions
    ) {
      try {
        dcf(p.assumptions);
      } catch {
        return apiError("Модель неприменима для этих допущений");
      }
    }
    const { data, error } = await auth.client.rpc("mx_write_research", {
      p_ticker: p.ticker,
      p_operation: p.operation,
      p_note:
        p.operation === "note" || p.operation === "import" ? p.note : null,
      p_assumptions:
        p.operation === "valuation" || p.operation === "import"
          ? (p.assumptions ?? null)
          : null,
    });
    if (error?.message?.includes("MX_RATE_LIMIT"))
      return apiError("Слишком много сохранений. Повторите через минуту.", 429);
    if (error)
      return apiError(
        error.code === "23503"
          ? "Компания не найдена"
          : "Не удалось сохранить исследование",
        error.code === "23503" ? 404 : 503,
      );
    return Response.json({ item: data?.[0] }, { headers: privateHeaders });
  } catch {
    return apiError("Не удалось обработать запрос", 400);
  }
}
export async function DELETE(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;
  try {
    const auth = await authenticated();
    if ("error" in auth) return auth.error;
    const p = (await readSmallJson(req)) as { ticker?: unknown };
    const parsed = tickerSchema.safeParse(p?.ticker);
    if (!parsed.success) return apiError("Некорректный тикер");
    const { error } = await auth.client
      .from("mx_research")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("ticker", parsed.data);
    if (error) return apiError("Не удалось удалить исследование", 503);
    return Response.json({ deleted: true }, { headers: privateHeaders });
  } catch {
    return apiError("Некорректный запрос", 400);
  }
}

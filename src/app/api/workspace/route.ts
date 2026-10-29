import { cloudConfigured } from "@/lib/supabase/config";
import { requestSupabase } from "@/lib/supabase/server";
import { validateWorkspace } from "@/lib/market/schema";
import {
  sameOrigin,
  readBounded,
  apiError,
  privateHeaders,
} from "@/lib/market/http";
async function auth() {
  if (!cloudConfigured())
    return { error: apiError("Облачное сохранение не подключено", 503) };
  const client = await requestSupabase();
  const { data, error } = await client.auth.getUser();
  return error || !data.user
    ? { error: apiError("Войдите в аккаунт", 401) }
    : { client, user: data.user };
}
export async function GET() {
  try {
    const a = await auth();
    if (a.error) return a.error;
    const { data, error } = await a
      .client!.from("mx_market_workspaces")
      .select("payload,revision,updated_at")
      .eq("user_id", a.user!.id)
      .maybeSingle();
    if (error)
      return apiError("Не удалось загрузить рабочее пространство", 503);
    return Response.json({ item: data }, { headers: privateHeaders });
  } catch {
    return apiError("Облачный сервис недоступен", 503);
  }
}
export async function POST(req: Request) {
  const g = sameOrigin(req);
  if (g) return g;
  try {
    const a = await auth();
    if (a.error) return a.error;
    const p = JSON.parse((await readBounded(req, 2_000_000)).toString("utf8"));
    if (!Number.isInteger(p.revision) || p.revision < 0)
      return apiError("Некорректная ревизия");
    const w = validateWorkspace(p.workspace);
    const { data, error } = await a.client!.rpc("mx_save_market_workspace", {
      p_payload: w,
      p_expected: p.revision,
    });
    if (error?.message.includes("MX_CONFLICT"))
      return apiError(
        "В облаке другая версия. Загрузите её перед сохранением; локальные данные сохранены.",
        409,
      );
    if (error)
      return apiError("Не удалось сохранить рабочее пространство", 503);
    return Response.json({ item: data?.[0] }, { headers: privateHeaders });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Некорректный запрос");
  }
}
export async function DELETE(req: Request) {
  const g = sameOrigin(req);
  if (g) return g;
  try {
    const a = await auth();
    if (a.error) return a.error;
    const { error } = await a
      .client!.from("mx_market_workspaces")
      .delete()
      .eq("user_id", a.user!.id);
    if (error) return apiError("Не удалось удалить облачные данные", 503);
    return Response.json({ deleted: true }, { headers: privateHeaders });
  } catch {
    return apiError("Облачный сервис недоступен", 503);
  }
}

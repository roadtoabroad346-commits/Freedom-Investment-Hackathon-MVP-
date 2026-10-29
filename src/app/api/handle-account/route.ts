import {
  mutationGuard,
  apiError,
  privateHeaders,
  readSmallJson,
} from "@/lib/api-security";
import { cloudConfig, cloudConfigured } from "@/lib/supabase/config";
import { requestSupabase } from "@/lib/supabase/server";
import {
  normalizeHandle,
  validPassword,
  validRecovery,
} from "@/lib/handle-auth";
export const maxDuration = 60;
export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;
  if (!cloudConfigured())
    return apiError("Облачная регистрация не настроена", 503);
  try {
    const p = (await readSmallJson(req)) as Record<string, unknown>;
    if (!p || !["register", "recover", "rotate"].includes(String(p.action)))
      return apiError("Некорректное действие");
    let token = process.env.SUPABASE_EDGE_ANON_JWT;
    let body: Record<string, unknown>;
    if (p.action === "rotate") {
      const client = await requestSupabase();
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return apiError("Войдите в аккаунт", 401);
      const session = await client.auth.getSession();
      token = session.data.session?.access_token;
      body = { action: "rotate" };
    } else {
      const handle = normalizeHandle(p.handle);
      if (!validPassword(p.password))
        return apiError("Пароль должен содержать 12–128 символов");
      if (p.action === "recover" && !validRecovery(p.recoveryCode))
        return apiError("Проверьте резервный ключ");
      body = {
        action: p.action,
        handle,
        password: p.password,
        ...(p.action === "recover" ? { recoveryCode: p.recoveryCode } : {}),
      };
    }
    if (!token) return apiError("Сервис регистрации не настроен", 503);
    const { url, key } = cloudConfig();
    const r = await fetch(url + "/functions/v1/mirror-x-accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: key,
        "x-mirror-client-ip":
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    const j = await r.json();
    if (!r.ok)
      return apiError(
        typeof j.error === "string" ? j.error : "Сервис регистрации недоступен",
        [400, 401, 409, 429, 503].includes(r.status) ? r.status : 503,
      );
    return Response.json(
      { handle: j.handle, recoveryCode: j.recoveryCode },
      { status: r.status, headers: privateHeaders },
    );
  } catch {
    return apiError("Не удалось обработать запрос регистрации", 400);
  }
}

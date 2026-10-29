import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  normalizeHandle,
  handleEmail,
  validPassword,
  validRecovery,
  handleFromEmail,
} from "./contract.ts";
const headers = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const hash = async (text: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const secret = () =>
  "mxr_" +
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 6000)
      return reply({ error: "Слишком большой запрос" }, 413);
    const reader = req.body?.getReader();
    if (!reader) return reply({ error: "Пустой запрос" }, 400);
    let text = "",
      size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 6000) {
        await reader.cancel();
        return reply({ error: "Слишком большой запрос" }, 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const p = JSON.parse(text);
    if (!["register", "recover", "rotate"].includes(p?.action))
      return reply({ error: "Некорректное действие" }, 400);
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
    if (!serviceKey)
      return reply({ error: "Сервис регистрации не настроен" }, 503);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const recoveryCode = secret(),
      newHash = await hash(recoveryCode);
    if (p.action === "rotate") {
      const token =
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user || !handleFromEmail(data.user.email))
        return reply({ error: "Войдите в аккаунт с логином" }, 401);
      const result = await admin.rpc("mx_rotate_handle_recovery", {
        p_user_id: data.user.id,
        p_new_hash: newHash,
      });
      if (result.error || !result.data)
        return reply({ error: "Не удалось заменить ключ" }, 503);
      return reply({ handle: result.data, recoveryCode });
    }
    const handle = normalizeHandle(p.handle);
    if (!validPassword(p.password))
      return reply({ error: "Пароль должен содержать 12–128 символов" }, 400);
    if (p.action === "recover" && !validRecovery(p.recoveryCode))
      return reply({ error: "Проверьте резервный ключ" }, 400);
    // The IP hint is not an identity. A hard global budget also applies if IP hints are spoofed.
    const fingerprint = await hash(
      req.headers.get("x-mirror-client-ip") ??
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        "unknown",
    );
    const budget = await admin.rpc("mx_handle_budget", {
      p_fingerprint: fingerprint,
    });
    if (budget.error)
      return reply({ error: "Сервис временно недоступен" }, 503);
    if (!budget.data)
      return reply({ error: "Слишком много попыток. Повторите позже." }, 429);
    if (p.action === "register") {
      const { data, error } = await admin.auth.admin.createUser({
        email: handleEmail(handle),
        password: p.password,
        email_confirm: true,
        user_metadata: {
          mirror_x_handle: handle,
          mirror_x_identity: "handle-v1",
        },
      });
      if (error || !data.user)
        return reply(
          { error: "Не удалось создать аккаунт. Попробуйте другой логин." },
          409,
        );
      const result = await admin.rpc("mx_initialize_handle", {
        p_handle: handle,
        p_user_id: data.user.id,
        p_hash: newHash,
      });
      if (result.error) {
        await admin.auth.admin.deleteUser(data.user.id);
        return reply(
          { error: "Не удалось завершить регистрацию. Повторите позже." },
          503,
        );
      }
      return reply({ handle, recoveryCode }, 201);
    }
    const oldHash = await hash(p.recoveryCode);
    const result = await admin.rpc("mx_exchange_handle_recovery", {
      p_handle: handle,
      p_old_hash: oldHash,
      p_new_hash: newHash,
    });
    if (result.error || !result.data)
      return reply({ error: "Логин или резервный ключ не подошёл" }, 400);
    const updated = await admin.auth.admin.updateUserById(result.data, {
      password: p.password,
    });
    if (updated.error) {
      await admin.rpc("mx_exchange_handle_recovery", {
        p_handle: handle,
        p_old_hash: newHash,
        p_new_hash: oldHash,
      });
      return reply(
        { error: "Пароль не обновлён. Попробуйте снова с прежним ключом." },
        503,
      );
    }
    return reply({ handle, recoveryCode });
  } catch {
    return reply({ error: "Проверьте формат логина и данные запроса" }, 400);
  }
});

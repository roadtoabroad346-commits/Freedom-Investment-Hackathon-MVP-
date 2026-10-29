import { z } from "zod";
import { requestSupabase } from "@/lib/supabase/server";
import { cloudConfigured } from "@/lib/supabase/config";
import {
  mutationGuard,
  readSmallJson,
  apiError,
  privateHeaders,
} from "@/lib/api-security";
export async function POST(req: Request) {
  const guard = mutationGuard(req);
  if (guard) return guard;
  if (!cloudConfigured()) return apiError("Сервис заявок не подключён", 503);
  try {
    const client = await requestSupabase();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return apiError("Войдите для отправки заявки", 401);
    const p = z
      .object({ message: z.string().trim().min(10).max(6000) })
      .strict()
      .safeParse(await readSmallJson(req));
    if (!p.success) return apiError("Опишите запрос: от 10 до 6000 символов");
    const { data, error } = await client
      .from("mx_pilot_requests")
      .insert({ user_id: user.id, message: p.data.message })
      .select("id")
      .single();
    if (error) return apiError("Не удалось сохранить заявку", 503);
    return Response.json({ id: data.id }, { headers: privateHeaders });
  } catch {
    return apiError("Сервис временно недоступен", 503);
  }
}

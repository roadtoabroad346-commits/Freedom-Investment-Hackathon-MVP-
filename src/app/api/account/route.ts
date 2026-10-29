import { cloudConfigured } from "@/lib/supabase/config";
import { requestSupabase } from "@/lib/supabase/server";
import { privateHeaders, apiError } from "@/lib/api-security";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!cloudConfigured())
    return Response.json(
      { configured: false, user: null },
      { headers: privateHeaders },
    );
  try {
    const client = await requestSupabase();
    const { data, error } = await client.auth.getUser();
    return Response.json(
      {
        configured: true,
        user: error
          ? null
          : data.user
            ? { id: data.user.id, email: data.user.email }
            : null,
      },
      { headers: privateHeaders },
    );
  } catch {
    return apiError("Сервис авторизации временно недоступен", 503);
  }
}

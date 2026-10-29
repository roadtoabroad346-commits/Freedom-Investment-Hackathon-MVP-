import { NextResponse } from "next/server";
import { requestSupabase } from "@/lib/supabase/server";
export async function GET(req: Request) {
  const url = new URL(req.url),
    code = url.searchParams.get("code");
  if (code) {
    try {
      const client = await requestSupabase();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(
            url.searchParams.get("recovery") === "1"
              ? "/account?recovery=1"
              : "/workspace",
            url.origin,
          ),
        );
    } catch {}
  }
  return NextResponse.redirect(
    new URL("/account?confirmation=failed", url.origin),
  );
}

import { createServerClient } from "@supabase/ssr";
import { cloudConfig } from "@/lib/supabase/config";
import { getModel } from "@/lib/data";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.MIRROR_QA_ENABLED !== "true"
  )
    return new Response(null, { status: 404 });
  const checks: Record<string, boolean> = {};
  const { url, key } = cloudConfig();
  const password = process.env.MIRROR_QA_PASSWORD,
    ea = process.env.MIRROR_QA_EMAIL_A,
    eb = process.env.MIRROR_QA_EMAIL_B;
  if (
    !password ||
    !ea?.endsWith("@example.invalid") ||
    !eb?.endsWith("@example.invalid")
  )
    return Response.json(
      { error: "QA fixture not configured" },
      { status: 503 },
    );
  function actor() {
    const jar = new Map<string, string>();
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (items) =>
          items.forEach((x) => {
            if (x.value) jar.set(x.name, x.value);
            else jar.delete(x.name);
          }),
      },
    });
    return { jar, client };
  }
  const a = actor(),
    b = actor();
  const origin = new URL(req.url).origin;
  async function api(
    path: string,
    jar: Map<string, string>,
    method = "GET",
    body?: unknown,
  ) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: [
        req.headers.get("cookie") ?? "",
        [...jar].map(([name, value]) => name + "=" + value).join("; "),
      ]
        .filter(Boolean)
        .join("; "),
    };
    const bypass =
      req.headers.get("x-vercel-protection-bypass") ??
      new URL(req.url).searchParams.get("x-vercel-protection-bypass");
    if (bypass) headers["x-vercel-protection-bypass"] = bypass;
    const r = await fetch(new URL(path, origin), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const value = await r.json().catch(() => ({}));
    return { status: r.status, value };
  }
  try {
    const la = await a.client.auth.signInWithPassword({ email: ea, password });
    const lb = await b.client.auth.signInWithPassword({ email: eb, password });
    checks.authenticated_two_users =
      !la.error && !lb.error && Boolean(la.data.user?.id !== lb.data.user?.id);
    if (!checks.authenticated_two_users)
      throw Error("Auth fixture login failed");
    checks.fresh_user_verified = Boolean(
      (await a.client.auth.getUser()).data.user?.id === la.data.user?.id,
    );
    const anon = await api("/api/research", new Map());
    checks.anonymous_api_denied = anon.status === 401;
    const watch = await api("/api/research", a.jar, "POST", {
      operation: "watch",
      ticker: "ADBE",
    });
    checks.watch_saved =
      watch.status === 200 && watch.value.item?.is_watchlisted === true;
    const note = await api("/api/research", a.jar, "POST", {
      operation: "note",
      ticker: "ADBE",
      note: "Temporary API QA",
    });
    checks.note_saved =
      note.status === 200 && note.value.item?.note === "Temporary API QA";
    const model = await api("/api/research", a.jar, "POST", {
      operation: "valuation",
      ticker: "ADBE",
      assumptions: getModel("ADBE"),
    });
    checks.model_saved =
      model.status === 200 && model.value.item?.assumptions?.currency === "USD";
    const read = await api("/api/research?ticker=ADBE", a.jar);
    checks.owner_reads_persisted =
      read.status === 200 && read.value.items?.[0]?.note === "Temporary API QA";
    const other = await api("/api/research", b.jar);
    checks.other_user_cannot_read =
      other.status === 200 && other.value.items?.length === 0;
    const forged = await api("/api/research", b.jar, "POST", {
      operation: "watch",
      ticker: "ADBE",
      user_id: la.data.user?.id,
    });
    checks.owner_forgery_rejected = forged.status === 400;
    const gone = await api("/api/research", b.jar, "DELETE", {
      ticker: "ADBE",
    });
    const still = await api("/api/research?ticker=ADBE", a.jar);
    checks.other_user_cannot_delete =
      gone.status === 200 && still.value.items?.length === 1;
    const imported = await api("/api/research", a.jar, "POST", {
      operation: "import",
      ticker: "ADBE",
      note: "Old local note",
    });
    checks.import_preserves_existing =
      imported.status === 200 &&
      imported.value.item?.note === "Temporary API QA";
    const drop = await api("/api/research", a.jar, "DELETE", {
      ticker: "ADBE",
    });
    const after = await api("/api/research", a.jar);
    checks.owner_delete =
      drop.status === 200 && after.value.items?.length === 0;
  } catch {
    checks.completed_without_error = false;
  } finally {
    await a.client.auth.signOut().catch(() => {});
    await b.client.auth.signOut().catch(() => {});
  }
  const pass =
    Object.values(checks).every(Boolean) && Object.keys(checks).length >= 12;
  return Response.json(
    { pass, checks },
    {
      status: pass ? 200 : 500,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

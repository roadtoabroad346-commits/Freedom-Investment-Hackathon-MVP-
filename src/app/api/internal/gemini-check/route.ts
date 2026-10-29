export const maxDuration = 60;
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview")
    return new Response(null, { status: 404 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ configured: false });
  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: { "x-goog-api-key": key },
        signal: AbortSignal.timeout(15000),
      },
    );
    const j = await r.json();
    if (!r.ok)
      return Response.json(
        {
          accepted: false,
          providerStatus: r.status,
          providerCode: j.error?.status ?? null,
          reason:
            j.error?.details
              ?.map((d: { reason?: string }) => d.reason)
              .filter(Boolean) ?? [],
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const models = (j.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((m: { name: string }) => m.name);
    return Response.json(
      { accepted: true, models },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json({ accepted: false, networkError: true });
  }
}

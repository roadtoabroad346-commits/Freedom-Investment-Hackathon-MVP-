import { getDataset, getPublishedSnapshot } from "@/lib/repository";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [data, snapshot] = await Promise.all([
      getDataset(),
      getPublishedSnapshot(),
    ]);
    return Response.json(
      {
        status: "ok",
        mode:
          data.storage === "supabase" ? "supabase" : "versioned-local-snapshot",
        database: data.storage === "supabase" ? "CONNECTED" : "NOT_CONFIGURED",
        coverage: data.coverage(),
        snapshotId: snapshot.id,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "unavailable",
        database: "UNAVAILABLE",
        error: "Не удалось проверить базу данных",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

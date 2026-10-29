import { getPublishedSnapshot } from "@/lib/repository";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await getPublishedSnapshot(), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return Response.json(
      { error: "Snapshot временно недоступен" },
      { status: 503 },
    );
  }
}

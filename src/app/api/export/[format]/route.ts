import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPublishedSnapshot } from "@/lib/repository";
import { finalGate } from "@/lib/build-snapshot";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ format: string }> },
) {
  const snapshot = await getPublishedSnapshot();
  const { format } = await params;
  if (!["xlsx", "pptx"].includes(format))
    return Response.json(
      { error: "Формат не поддерживается" },
      { status: 400 },
    );
  if (
    new URL(req.url).searchParams.get("final") === "1" &&
    !finalGate(snapshot).passed
  )
    return Response.json(
      {
        error: "FINAL заблокирован: проверки не пройдены",
        blockers: snapshot.blockers,
      },
      { status: 409 },
    );
  const name = `FREEDOM_MIRROR_X_2026_PRELIMINARY.${format}`;
  try {
    const data = await readFile(
      path.join(process.cwd(), "public", "downloads", name),
    );
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type":
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${name}"`,
        "X-Snapshot-Id": snapshot.id,
      },
    });
  } catch {
    return Response.json(
      { error: "Экспорт ещё не собран. Запустите npm run exports." },
      { status: 503 },
    );
  }
}

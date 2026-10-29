import { getDataset, getPublishedSnapshot } from "@/lib/repository";
import { researchBrief } from "@/lib/brief";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const [data, published] = await Promise.all([
    getDataset(),
    getPublishedSnapshot(),
  ]);
  const { ticker: t } = await params,
    ticker = t.toUpperCase(),
    brief = researchBrief(ticker, data, published);
  if (!brief)
    return Response.json({ error: "Тикер не найден" }, { status: 404 });
  return new Response(brief, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="MIRROR_X_${ticker}_research.md"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

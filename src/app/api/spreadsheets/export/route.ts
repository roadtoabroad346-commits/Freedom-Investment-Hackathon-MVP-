import { getDataset } from "@/lib/repository";
import { workbook, pricesCsv, marketWorkbook } from "@/lib/market/spreadsheets";
import { validateWorkspace } from "@/lib/market/schema";
import {
  sameOrigin,
  readBounded,
  apiError,
  privateHeaders,
} from "@/lib/market/http";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(req: Request) {
  const guard = sameOrigin(req);
  if (guard) return guard;
  try {
    const w = validateWorkspace(
      JSON.parse((await readBounded(req, 2_000_000)).toString("utf8")),
    );
    const csv = new URL(req.url).searchParams.get("format") === "csv";
    return new Response(
      csv ? pricesCsv(w) : new Uint8Array(await workbook(w)),
      {
        headers: {
          ...privateHeaders,
          "Content-Type": csv
            ? "text/csv; charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="MIRROR_X_workspace.${csv ? "csv" : "xlsx"}"`,
        },
      },
    );
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Ошибка экспорта");
  }
}

export async function GET() {
  try {
    const { universe } = await getDataset();
    return new Response(new Uint8Array(await marketWorkbook(universe)), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="MIRROR_X_market_UNDATED.xlsx"',
        "Cache-Control": "public, max-age=120",
      },
    });
  } catch {
    return apiError("Не удалось выгрузить справочник", 503);
  }
}

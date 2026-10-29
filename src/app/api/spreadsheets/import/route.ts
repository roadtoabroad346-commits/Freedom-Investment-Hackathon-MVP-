import {
  readSpreadsheet,
  SpreadsheetError,
  FILE_LIMIT,
} from "@/lib/market/spreadsheets";
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
    const p = new URL(req.url).searchParams,
      filename = p.get("filename") ?? "";
    const source = (p.get("source") ?? "").trim();
    const basis = p.get("basis") ?? "unknown";
    if (
      !source ||
      source.length > 300 ||
      !["adjusted", "unadjusted", "unknown"].includes(basis)
    )
      return apiError("Укажите источник и тип корректировки цен");
    const w = await readSpreadsheet(
      await readBounded(req, FILE_LIMIT),
      filename,
      source,
      basis as "adjusted" | "unadjusted" | "unknown",
    );
    return Response.json(
      { workspace: w, issues: [] },
      { headers: privateHeaders },
    );
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Не удалось прочитать файл",
        issues: e instanceof SpreadsheetError ? e.issues : [],
      },
      { status: 400, headers: privateHeaders },
    );
  }
}

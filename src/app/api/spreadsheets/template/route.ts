import { workbook } from "@/lib/market/spreadsheets";
import { emptyWorkspace } from "@/lib/market/schema";
export async function GET() {
  return new Response(new Uint8Array(await workbook(emptyWorkspace, true)), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="MIRROR_X_template.xlsx"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}

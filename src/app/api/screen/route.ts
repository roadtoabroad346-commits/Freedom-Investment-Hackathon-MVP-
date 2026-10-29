import { z } from "zod";
import { screen } from "@/lib/screening";
import { universe, coverage } from "@/lib/data";
const query = z.object({
  q: z.string().max(80).optional(),
  sector: z.string().max(100).optional(),
  pe: z.coerce.number().positive().optional(),
  cap: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["ticker", "score", "cap", "pe"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  ebitda: z.enum(["0", "1"]).optional(),
  dated: z.enum(["0", "1"]).optional(),
});
export function GET(req: Request) {
  const result = query.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!result.success)
    return Response.json(
      {
        error: "Некорректные фильтры",
        details: result.error.issues.map((i) => i.message),
      },
      { status: 400 },
    );
  const p = result.data;
  return Response.json(
    {
      ...screen(universe, {
        query: p.q,
        sector: p.sector,
        maxPe: p.pe,
        minCap: p.cap,
        positiveEbitda: p.ebitda === "1",
        datedOnly: p.dated === "1",
        sort: p.sort,
        page: p.page,
        pageSize: p.pageSize,
      }),
      coverage: coverage(),
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}

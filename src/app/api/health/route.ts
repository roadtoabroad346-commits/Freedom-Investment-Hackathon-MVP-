import { coverage } from "@/lib/data";
import { snapshot } from "@/lib/snapshot";
export function GET() {
  return Response.json({
    status: "ok",
    mode: "versioned-local-snapshot",
    database: "NOT_CONNECTED",
    coverage: coverage(),
    snapshotId: snapshot.id,
  });
}

import { snapshot } from "@/lib/snapshot";
export function GET() {
  return Response.json(snapshot, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}

import { writeFile, mkdir } from "node:fs/promises";
import { buildSnapshot } from "../src/lib/build-snapshot";
const s = buildSnapshot();
await mkdir("data", { recursive: true });
await writeFile("data/snapshot.json", JSON.stringify(s, null, 2));
console.log(
  `${s.id} · ${s.status} · ${s.companies.length} primary research candidates`,
);

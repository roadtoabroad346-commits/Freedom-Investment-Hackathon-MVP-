import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { makeWorkbook, makePresentation } from "../src/lib/exports";
import { snapshot } from "../src/lib/snapshot";
await mkdir("public/downloads", { recursive: true });
const files = [];
for (const [ext, build] of [
  ["xlsx", makeWorkbook],
  ["pptx", makePresentation],
] as const) {
  const bytes = await build();
  const name = `FREEDOM_MIRROR_X_2026_PRELIMINARY.${ext}`;
  await writeFile(
    `public/downloads/${name}`,
    Buffer.from(bytes as ArrayBuffer),
  );
  files.push({
    name,
    sha256: createHash("sha256")
      .update(Buffer.from(bytes as ArrayBuffer))
      .digest("hex"),
  });
  console.log(`${name} created`);
}
await writeFile(
  "public/downloads/manifest.json",
  JSON.stringify(
    { snapshotId: snapshot.id, status: snapshot.status, files },
    null,
    2,
  ),
);

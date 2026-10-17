import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { withAuthorTools } from "./author-tools.mjs";
import { createGymManifest } from "./manifest.mjs";
import { checkCatalog } from "./check-catalog.mjs";

const root = new URL("../", import.meta.url);
const snapshot = JSON.parse(
  await readFile(new URL("tools/sdk/snapshot.json", root)),
);
for (const [path, expected] of Object.entries(snapshot.files)) {
  if (!/^[a-zA-Z0-9._/-]+$/.test(path) || path.split("/").includes(".."))
    throw new Error("Invalid author-tool snapshot path.");
  const bytes = await readFile(new URL(`tools/sdk/${path}`, root));
  if (createHash("sha256").update(bytes).digest("hex") !== expected)
    throw new Error(`Author-tool snapshot changed: ${path}`);
}
async function checkDirectory(directory) {
  for (const entry of await readdir(new URL(`${directory}/`, root), {
    withFileTypes: true,
  })) {
    const name = entry.name;
    if (entry.isDirectory()) {
      await checkDirectory(`${directory}/${name}`);
      continue;
    }
    if (!/\.(mjs|ts)$/.test(name)) continue;
    const source = await readFile(
      new URL(`${directory}/${name}`, root),
      "utf8",
    );
    if (source.trimEnd().split("\n").length > 500)
      throw new Error(
        `Maintained source exceeds 500 lines: ${directory}/${name}`,
      );
  }
}
for (const directory of ["src", "tools/sdk"]) await checkDirectory(directory);
const manifest = createGymManifest();
await withAuthorTools(({ appJsonSchema, parseAppManifest }) => {
  for (const table of manifest.tables) appJsonSchema.parse(table.schema);
  parseAppManifest(manifest);
});
const catalogSize = await checkCatalog();
process.stdout.write(
  `Validated Gym's declarative manifest, ${manifest.tables.length} App table schemas, ${catalogSize} pinned public catalog entries and standalone author tools.\n`,
);

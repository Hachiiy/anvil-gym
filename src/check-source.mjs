import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { withAuthorTools } from "./author-tools.mjs";
import { tables } from "./domain-schema.mjs";
import { createGymManifest } from "./manifest.mjs";
import { checkCatalog } from "./check-catalog.mjs";

const root = new URL("../", import.meta.url);
const snapshot = JSON.parse(
  await readFile(new URL("vendor/snapshot.json", root)),
);
for (const [path, expected] of Object.entries(snapshot.files)) {
  if (!/^[a-zA-Z0-9._/-]+$/.test(path) || path.split("/").includes(".."))
    throw new Error("Invalid author-tool snapshot path.");
  const bytes = await readFile(new URL(`vendor/${path}`, root));
  if (createHash("sha256").update(bytes).digest("hex") !== expected)
    throw new Error(`Author-tool snapshot changed: ${path}`);
}
for (const directory of [
  "src",
  "vendor/author",
  "vendor/contracts",
  "vendor/contracts/apps",
]) {
  for (const name of await readdir(new URL(`${directory}/`, root))) {
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
await withAuthorTools(({ appJsonSchema, parseAppManifest }) => {
  for (const table of tables) appJsonSchema.parse(table.schema);
  parseAppManifest(createGymManifest());
});
const catalogSize = await checkCatalog();
process.stdout.write(
  `Validated Gym's declarative manifest, ${tables.length} App table schemas, ${catalogSize} pinned public catalog entries and standalone author tools.\n`,
);

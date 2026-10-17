import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import type { build } from "esbuild";
import { parseAppManifest } from "../contracts/apps/index.js";
import { appPlatformLimits } from "../contracts/limits.js";

// Called by explicit author commands only. Package readers never import this module.
export async function compileAppSource(entry: string, compile: typeof build) {
  const result = await compile({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    target: "es2022",
    logLevel: "silent",
    sourcemap: false,
  });
  const bytes = result.outputFiles[0]?.contents;
  if (!bytes || bytes.byteLength > appPlatformLimits.expandedBytes)
    throw new Error("Author output exceeds the build budget.");
  const temporary = await mkdtemp(join(tmpdir(), "anvil-author-source-"));
  const path = join(temporary, "definition.cjs");
  const require = createRequire(import.meta.url);
  try {
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
    const exported: unknown = require(path);
    if (!exported || typeof exported !== "object" || !("default" in exported))
      throw new Error("src/app.ts must export the App definition as default.");
    return parseAppManifest(exported.default);
  } finally {
    delete require.cache[path];
    await rm(temporary, { recursive: true, force: true });
  }
}

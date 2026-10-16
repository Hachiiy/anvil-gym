import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Source maps and machine paths are never part of an App release.
export async function withAuthorTools(operation) {
  const temporary = await mkdtemp(join(tmpdir(), "gym-author-"));
  try {
    const output = join(temporary, "author.mjs");
    await build({
      entryPoints: [
        fileURLToPath(new URL("./author-entry.ts", import.meta.url)),
      ],
      bundle: true,
      platform: "node",
      format: "esm",
      write: true,
      outfile: output,
      sourcemap: false,
      logLevel: "silent",
    });
    return await operation(await import(pathToFileURL(output).href), build);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

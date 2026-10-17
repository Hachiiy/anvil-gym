#!/usr/bin/env node
// Bundle only the trusted author tool. App compilation is an explicit build command.
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const temporary = await mkdtemp(join(tmpdir(), "anvil-app-cli-"));
try {
  const output = join(temporary, "cli.mjs");
  await build({
    entryPoints: [fileURLToPath(new URL("tooling/cli.ts", import.meta.url))],
    outfile: output,
    platform: "node",
    format: "esm",
    bundle: true,
    logLevel: "silent",
    plugins: [
      {
        name: "author-typechecker",
        setup(compiler) {
          compiler.onResolve({ filter: /^typescript$/ }, () => ({
            path: createRequire(import.meta.url).resolve("typescript"),
            external: true,
          }));
        },
      },
    ],
  });
  const { runCli } = await import(pathToFileURL(output).href);
  process.stdout.write(
    `${JSON.stringify(
      await runCli(process.argv.slice(2), (options) =>
        build({
          ...options,
          alias: {
            "@anvil/app-sdk/author": fileURLToPath(
              new URL("src/author.ts", import.meta.url),
            ),
          },
        }),
      ),
      null,
      2,
    )}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "App tool failed."}\n`,
  );
  process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}

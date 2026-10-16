import {
  readFile,
  writeFile,
  mkdir,
  lstat,
  readdir,
  realpath,
} from "node:fs/promises";
import { resolve, relative, dirname, sep } from "node:path";
import type { build } from "esbuild";
import {
  parseAppManifest,
  appReleaseIdentitySchema,
} from "../contracts/apps/index.js";
import { appPlatformLimits as limits } from "../contracts/limits.js";
import {
  buildAppPackage,
  canonicalAppJson,
  describeAppRelease,
  readAppJson,
} from "./package.js";
import { runAppConformance } from "./conformance.js";

async function regularFile(root: string, path: string) {
  const absolute = resolve(root, path);
  if (
    !relative(root, absolute) ||
    relative(root, absolute).startsWith(`..${sep}`)
  )
    throw new Error("Asset is outside the author directory.");
  const parts = relative(root, absolute).split(sep);
  let current = root;
  for (const part of parts) {
    current = resolve(current, part);
    if ((await lstat(current)).isSymbolicLink())
      throw new Error("Author assets cannot use symlinks.");
  }
  const stat = await lstat(absolute);
  if (!stat.isFile() || stat.size > limits.fileBytes)
    throw new Error("Invalid author asset size/type.");
  return readFile(absolute);
}
export async function runCli(args: string[], compile: typeof build) {
  const [command, directory, outputDirectory, identityFile] = args;
  if (
    !command ||
    !directory ||
    !["validate", "build", "package"].includes(command)
  )
    throw new Error(
      "Usage: anvil-app validate <directory> | build <directory> <output> | package <directory> <output> <release-identity.json>",
    );
  const root = await realpath(resolve(directory));
  const manifest = parseAppManifest(
    readAppJson(await regularFile(root, "manifest.json")),
  );
  if (command === "validate") {
    const assets = new Map<string, Uint8Array>();
    for (const asset of manifest.assets)
      assets.set(asset.path, await regularFile(root, asset.path));
    buildAppPackage(manifest, assets);
    return runAppConformance(manifest);
  }
  if (!outputDirectory) throw new Error("An output directory is required.");
  const output = resolve(outputDirectory);
  if (output === root || !relative(root, output).startsWith(".."))
    throw new Error("Use an output directory outside the author source.");
  const assets = new Map<string, Uint8Array>();
  for (const asset of manifest.assets) {
    let bytes: Uint8Array;
    const source =
      asset.mediaType === "text/javascript"
        ? asset.path.replace(/\.js$/, ".ts")
        : undefined;
    let hasSource = false;
    if (command === "build" && source) {
      try {
        await lstat(resolve(root, source));
        hasSource = true;
      } catch {
        /* A prebuilt asset is also supported. */
      }
    }
    if (hasSource && source) {
      await regularFile(root, source);
      const result = await compile({
        entryPoints: [resolve(root, source)],
        bundle: true,
        write: false,
        platform: "browser",
        format: "iife",
        target: "es2022",
        logLevel: "silent",
      });
      bytes = result.outputFiles[0]!.contents;
    } else bytes = await regularFile(root, asset.path);
    assets.set(asset.path, bytes);
  }
  const built = buildAppPackage(manifest, assets);
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length)
    throw new Error("Output directory must be empty.");
  if (command === "build") {
    for (const [path, bytes] of new Map([
      ...assets,
      ["manifest.json", built.manifestBytes],
    ])) {
      const target = resolve(output, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: "wx" });
    }
    return { status: "built", artifactSha256: built.artifactSha256 };
  }
  if (!identityFile)
    throw new Error("Exact immutable release identity is required.");
  const identity = appReleaseIdentitySchema.parse(
    readAppJson(await readFile(resolve(identityFile))),
  );
  const descriptor = describeAppRelease(built, identity);
  await writeFile(resolve(output, descriptor.artifact.name), built.archive, {
    flag: "wx",
  });
  await writeFile(resolve(output, "anvil.manifest.json"), built.manifestBytes, {
    flag: "wx",
  });
  await writeFile(
    resolve(output, "anvil.release.json"),
    canonicalAppJson(descriptor),
    { flag: "wx" },
  );
  for (const asset of descriptor.assets)
    await writeFile(
      resolve(output, asset.releaseName),
      assets.get(asset.path)!,
      { flag: "wx" },
    );
  return {
    status: "packaged",
    artifactSha256: built.artifactSha256,
    manifestSha256: built.manifestSha256,
  };
}

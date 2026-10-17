import { readFile, lstat, realpath } from "node:fs/promises";
import { resolve, relative, sep, join } from "node:path";
import type { build } from "esbuild";
import {
  parseAppManifest,
  appDevelopmentProjectSchema,
} from "../contracts/apps/index.js";
import { appPlatformLimits as limits } from "../contracts/limits.js";
import { buildAppPackage, readAppJson } from "../src/package.js";
import { checkAppTypes } from "./author-types.js";
import { compileAppSource } from "./author-source.js";

export async function readAuthorFile(root: string, path: string) {
  const absolute = resolve(root, path);
  if (
    !relative(root, absolute) ||
    relative(root, absolute).startsWith(`..${sep}`)
  )
    throw new Error("Asset is outside the author directory.");
  let current = root;
  for (const part of relative(root, absolute).split(sep)) {
    current = resolve(current, part);
    if ((await lstat(current)).isSymbolicLink())
      throw new Error("Author assets cannot use symlinks.");
  }
  const stat = await lstat(absolute);
  if (!stat.isFile() || stat.size > limits.fileBytes)
    throw new Error("Invalid author asset size/type.");
  return readFile(absolute);
}

export async function readAuthorPackage(root: string, compile?: typeof build) {
  if (compile) checkAppTypes(root);
  const manifest = compile
    ? await compileAppSource(join(root, "src/app.ts"), compile)
    : parseAppManifest(
        readAppJson(await readAuthorFile(root, "manifest.json")),
      );
  const assets = new Map<string, Uint8Array>();
  for (const asset of manifest.assets)
    assets.set(asset.path, await readAuthorFile(root, asset.path));
  return { ...buildAppPackage(manifest, assets), assets };
}

export async function readDevelopmentProject(directory: string) {
  const project = await realpath(resolve(directory));
  const path = join(project, "anvil.app.json");
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size > 8192)
    throw Error("Invalid anvil.app.json project configuration.");
  const data = readAppJson(await readFile(path));
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !("schemaVersion" in data) ||
    data.schemaVersion !== "1.0" ||
    !("packageKey" in data)
  )
    throw Error("Invalid anvil.app.json project configuration.");
  return {
    project,
    projectKey: appDevelopmentProjectSchema.parse(data.packageKey),
  };
}

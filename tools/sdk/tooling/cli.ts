import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  realpath,
} from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import type { build } from "esbuild";
import { appReleaseIdentitySchema } from "../contracts/apps/index.js";
import {
  canonicalAppJson,
  describeAppRelease,
  readAppJson,
} from "../src/package.js";
import { readAuthorPackage } from "./author-project.js";
import { runAppConformance } from "../src/conformance.js";
import { runDevelopmentCommand } from "./development-command.js";
import { runDevelopmentWatchCommand } from "./development-watch-command.js";

import { runReleaseCommand } from "./release-command.js";

export async function runCli(args: string[], compile: typeof build) {
  if (args[0] === "release") return runReleaseCommand(args.slice(1), compile);
  if (args[0] === "connect") return runDevelopmentCommand(args.slice(1));
  if (args[0] === "dev")
    return runDevelopmentWatchCommand(args.slice(1), compile);
  const [command, directory, outputDirectory, identityFile] = args;
  if (
    !command ||
    !directory ||
    !["validate", "build", "package", "check"].includes(command)
  )
    throw new Error(
      "Usage: anvil-app connect|dev <project> [origin] [--new] | check <project> | validate <prebuilt-directory> | build <project> <output> | package <directory> <output> <release-identity.json>",
    );
  const root = await realpath(resolve(directory));
  const { manifest, assets, ...built } = await readAuthorPackage(
    root,
    command === "build" || command === "check" ? compile : undefined,
  );
  if (command === "validate" || command === "check") {
    return runAppConformance(manifest);
  }
  if (!outputDirectory) throw new Error("An output directory is required.");
  const output = resolve(outputDirectory);
  if (output === root || !relative(root, output).startsWith(".."))
    throw new Error("Use an output directory outside the author source.");
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
  const descriptor = describeAppRelease({ ...built, manifest }, identity);
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

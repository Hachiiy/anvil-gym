import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { z } from "zod";
import { appSha256 } from "../src/package.js";

export const authorReleaseStateSchema = z.strictObject({
  publicationId: z.uuid(),
  repositoryId: z.number().int().positive().safe(),
  publisherId: z.number().int().positive().safe(),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
  version: z.string(),
  artifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
  manifestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  phase: z.enum(["prepared", "creating", "identified", "published"]),
  releaseId: z.number().int().positive().safe().nullable(),
});
export type AuthorReleaseState = z.infer<typeof authorReleaseStateSchema>;
export function releaseGit(project: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd: project,
    encoding: "utf8",
    timeout: 15_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
export function authorRepository(project: string) {
  if (resolve(releaseGit(project, "rev-parse", "--show-toplevel")) !== project)
    throw Error("Release from the root of the App's own Git repository.");
  if (releaseGit(project, "status", "--porcelain", "--untracked-files=normal"))
    throw Error("Commit the App source before publishing a release.");
  const origin = releaseGit(project, "remote", "get-url", "origin");
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(
      origin,
    );
  if (!match)
    throw Error(
      "The origin must identify the intended public GitHub App repository.",
    );
  const commit = releaseGit(project, "rev-parse", "HEAD");
  if (!/^[a-f0-9]{40}$/.test(commit))
    throw Error("Unsupported source commit identity.");
  return { repository: match[1]!, commit };
}
export function releaseStateDirectory(project: string, version: string) {
  return join(
    homedir(),
    ".local",
    "state",
    "anvil-app",
    "releases",
    appSha256(new TextEncoder().encode(project)),
    version,
  );
}
export async function readReleaseState(directory: string) {
  try {
    return authorReleaseStateSchema.parse(
      JSON.parse(await readFile(join(directory, "release.json"), "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw Error(
      "The saved publication state is invalid; preserve it for manual recovery.",
    );
  }
}
export async function saveReleaseState(
  directory: string,
  state: AuthorReleaseState,
) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const pending = join(directory, "release.pending.json");
  await writeFile(
    pending,
    JSON.stringify(authorReleaseStateSchema.parse(state)),
    { mode: 0o600 },
  );
  await rename(pending, join(directory, "release.json"));
}

// The lock protects the complete saved-identity transition and publication.
export async function lockRelease(directory: string) {
  const { open, unlink } = await import("node:fs/promises");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "release.lock");
  let handle;
  try {
    handle = await open(path, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    throw Error(
      `Another publication may be running. If it was killed, remove its lock only after it has stopped: ${path}`,
    );
  }
  return async () => {
    await handle.close();
    await unlink(path);
  };
}

import { execFileSync } from "node:child_process";
import { z } from "zod";

const id = z.number().int().positive().safe();
export const releaseRepositorySchema = z.object({
  id,
  full_name: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  private: z.boolean(),
  owner: z.object({ id }),
});
export const githubReleaseSchema = z.object({
  id,
  tag_name: z.string(),
  target_commitish: z.string(),
  draft: z.boolean(),
  immutable: z.boolean().optional(),
  html_url: z.url(),
  body: z.string().nullable().optional(),
});
export const releaseAssetSchema = z.object({
  id,
  name: z.string(),
  size: z.number().int().nonnegative(),
  state: z.string(),
  digest: z.string().nullable().optional(),
});
export type ReleaseRepository = z.infer<typeof releaseRepositorySchema>;
export type GitHubRelease = z.infer<typeof githubReleaseSchema>;
export type ReleaseAsset = z.infer<typeof releaseAssetSchema>;
export interface ReleaseGitHub {
  json(
    path: string,
    method?: "GET" | "POST" | "PATCH",
    body?: unknown,
    allowNotFound?: boolean,
  ): unknown;
  upload(
    repository: string,
    releaseId: number,
    name: string,
    file: string,
  ): unknown;
  download(repository: string, assetId: number): Uint8Array;
}

export class GitHubReleaseRequestError extends Error {
  constructor(readonly status: number | null) {
    super(
      "GitHub request failed. Check local gh authentication/network and rerun the same release command; pending publication is retained.",
    );
  }
}

function gh(args: string[], input?: string) {
  try {
    return execFileSync("gh", args, {
      input,
      timeout: 60_000,
      maxBuffer: 40 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr =
      (error as { stderr?: Buffer }).stderr?.toString("utf8") ?? "";
    const status = /\(HTTP (\d{3})\)/.exec(stderr)?.[1];
    throw new GitHubReleaseRequestError(status ? Number(status) : null);
  }
}
export const releaseGitHub: ReleaseGitHub = {
  json(path, method = "GET", body, allowNotFound = false) {
    try {
      const args = [
        "api",
        path,
        "--hostname",
        "github.com",
        "--method",
        method,
      ];
      if (body !== undefined) args.push("--input", "-");
      return JSON.parse(
        gh(
          args,
          body === undefined ? undefined : JSON.stringify(body),
        ).toString("utf8"),
      );
    } catch (error) {
      if (
        allowNotFound &&
        error instanceof GitHubReleaseRequestError &&
        error.status === 404
      )
        return null;
      throw error;
    }
  },
  upload(repository, releaseId, name, file) {
    const url = `https://uploads.github.com/repos/${repository}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
    return JSON.parse(
      gh([
        "api",
        url,
        "--hostname",
        "github.com",
        "--method",
        "POST",
        "-H",
        "Content-Type: application/octet-stream",
        "--input",
        file,
      ]).toString("utf8"),
    );
  },
  download(repository, assetId) {
    return gh([
      "api",
      `repos/${repository}/releases/assets/${assetId}`,
      "--hostname",
      "github.com",
      "-H",
      "Accept: application/octet-stream",
    ]);
  },
};

export function releaseAssets(
  client: ReleaseGitHub,
  repository: string,
  releaseId: number,
) {
  const items = z
    .array(releaseAssetSchema)
    .max(100)
    .parse(
      client.json(
        `repos/${repository}/releases/${releaseId}/assets?per_page=100`,
      ),
    );
  if (items.length === 100) throw Error("This release has too many assets.");
  return items;
}
export function findRelease(
  client: ReleaseGitHub,
  repository: string,
  tag: string,
) {
  // This also finds drafts, including a draft whose creation response was lost.
  for (let page = 1; page <= 10; page++) {
    const releases = z
      .array(githubReleaseSchema)
      .max(100)
      .parse(
        client.json(`repos/${repository}/releases?per_page=100&page=${page}`),
      );
    const matches = releases.filter((release) => release.tag_name === tag);
    if (matches.length > 1)
      throw Error(
        "Multiple releases use this version. Resolve them in GitHub before retrying.",
      );
    if (matches.length) return matches[0]!;
    if (releases.length < 100) return null;
  }
  throw Error("The release history exceeds the supported lookup bound.");
}
export function verifyReleaseTag(
  client: ReleaseGitHub,
  repository: string,
  tag: string,
  commit: string,
  required = true,
) {
  const objectSchema = z.object({
    object: z.object({
      type: z.enum(["commit", "tag"]),
      sha: z.string().regex(/^[a-f0-9]{40}$/),
    }),
  });
  const ref = client.json(
    `repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`,
    "GET",
    undefined,
    !required,
  );
  if (ref === null && !required) return;
  let target = objectSchema.parse(ref).object;
  for (let depth = 0; target.type === "tag" && depth < 5; depth++)
    target = objectSchema.parse(
      client.json(`repos/${repository}/git/tags/${target.sha}`),
    ).object;
  if (target.type !== "commit" || target.sha !== commit)
    throw Error("The release tag does not identify this exact source commit.");
}

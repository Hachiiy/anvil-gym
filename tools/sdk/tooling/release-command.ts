import { randomUUID } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { build } from "esbuild";
import { z } from "zod";
import { appDiscoveryHintSchema } from "../contracts/apps/index.js";
import {
  appSha256,
  canonicalAppJson,
  describeAppRelease,
} from "../src/package.js";
import { runAppConformance } from "../src/conformance.js";
import { readAuthorPackage } from "./author-project.js";
import {
  authorRepository,
  lockRelease,
  readReleaseState,
  releaseStateDirectory,
  saveReleaseState,
  type AuthorReleaseState,
} from "./release-state.js";
import {
  findRelease,
  githubReleaseSchema,
  releaseAssets,
  releaseGitHub,
  releaseRepositorySchema,
  verifyReleaseTag,
  type ReleaseGitHub,
  type GitHubRelease,
} from "./release-github.js";

export async function runReleaseCommand(
  args: string[],
  compile: typeof build,
  github: ReleaseGitHub = releaseGitHub,
  stateDirectory = releaseStateDirectory,
) {
  if (args.length !== 1)
    throw Error(
      "Usage: anvil-app release <project>. Requires local GitHub CLI authentication and enabled immutable releases.",
    );
  const project = await realpath(resolve(args[0]!));
  const source = authorRepository(project);
  const built = await readAuthorPackage(project, compile);
  const conformance = await runAppConformance(built.manifest);
  const assertSource = () => {
    const current = authorRepository(project);
    if (
      current.commit !== source.commit ||
      current.repository !== source.repository
    )
      throw Error(
        "The author source changed during release. Restore the exact source or use a new version.",
      );
  };
  assertSource();
  const version = built.manifest.package.version;
  const packageVersion = z
    .object({ version: z.string() })
    .parse(
      JSON.parse(await readFile(join(project, "package.json"), "utf8")),
    ).version;
  const hint = appDiscoveryHintSchema.parse(
    JSON.parse(await readFile(join(project, "anvil.app.json"), "utf8")),
  );
  if (
    packageVersion !== version ||
    hint.packageKey !== built.manifest.package.key
  )
    throw Error(
      "Align package.json version and anvil.app.json packageKey with the built App.",
    );
  const repository = releaseRepositorySchema.parse(
    github.json(`repos/${source.repository}`),
  );
  if (repository.private)
    throw Error("Market release publication requires a public repository.");
  const name = repository.full_name;
  const immutable = z
    .object({ enabled: z.boolean() })
    .parse(github.json(`repos/${name}/immutable-releases`));
  if (!immutable.enabled)
    throw Error(
      "Enable immutable releases in the App repository before publication.",
    );
  const remoteCommit = z
    .object({ sha: z.string() })
    .parse(github.json(`repos/${name}/commits/${source.commit}`));
  if (remoteCommit.sha !== source.commit)
    throw Error("Push the exact source commit before publication.");
  const tag = `v${version}`;
  verifyReleaseTag(github, name, tag, source.commit, false);
  const directory = stateDirectory(project, version);
  const unlock = await lockRelease(directory);
  try {
    const prior = await readReleaseState(directory);
    const intent = {
      repositoryId: repository.id,
      publisherId: repository.owner.id,
      sourceCommit: source.commit,
      version,
      artifactDigest: built.artifactSha256,
      manifestDigest: built.manifestSha256,
    };
    if (
      prior &&
      Object.entries(intent).some(
        ([key, value]) => prior[key as keyof AuthorReleaseState] !== value,
      )
    )
      throw Error(
        "This version already has a different saved publication identity. Use a new version; do not overwrite its release.",
      );
    let state: AuthorReleaseState = prior ?? {
      ...intent,
      publicationId: randomUUID(),
      phase: "prepared",
      releaseId: null,
    };
    await saveReleaseState(directory, state);
    let release: GitHubRelease | null = state.releaseId
      ? githubReleaseSchema.parse(
          github.json(`repos/${name}/releases/${state.releaseId}`),
        )
      : findRelease(github, name, tag);
    const marker = `<!-- anvil-publication:${state.publicationId} -->`;
    if (
      release &&
      (!prior ||
        (state.releaseId === null && state.phase !== "creating") ||
        !release.body?.includes(marker))
    )
      throw Error(
        "An existing release is outside this saved publication. It will not be adopted or changed.",
      );
    assertSource();
    if (!release) {
      if (state.phase !== "prepared")
        throw Error(
          "Draft creation is uncertain. Retry after GitHub reconciles it; no second draft will be created automatically.",
        );
      state = { ...state, phase: "creating" };
      await saveReleaseState(directory, state);
      release = githubReleaseSchema.parse(
        github.json(`repos/${name}/releases`, "POST", {
          tag_name: tag,
          target_commitish: source.commit,
          name: `${built.manifest.package.name} ${version}`,
          body: `Native Anvil App package. Install through Anvil Market after exact-package review and permission consent.\n\n${marker}`,
          draft: true,
          prerelease: false,
        }),
      );
    }
    if (
      release.tag_name !== tag ||
      release.target_commitish !== source.commit ||
      (state.releaseId !== null && release.id !== state.releaseId)
    )
      throw Error(
        "The remote release does not match this saved version and commit.",
      );
    state = { ...state, phase: "identified", releaseId: release.id };
    await saveReleaseState(directory, state);
    const descriptor = describeAppRelease(built, {
      provider: "github",
      repositoryId: repository.id,
      publisherId: repository.owner.id,
      releaseId: release.id,
      commitSha: source.commit,
      immutable: true,
      version,
    });
    const files = new Map<string, Uint8Array>([
      ["anvil.release.json", canonicalAppJson(descriptor)],
      ["anvil.manifest.json", built.manifestBytes],
      [descriptor.artifact.name, built.archive],
      ...descriptor.assets.map(
        (asset) => [asset.releaseName, built.assets.get(asset.path)!] as const,
      ),
    ]);
    let assets = releaseAssets(github, name, release.id);
    if (
      assets.some((asset) => !files.has(asset.name)) ||
      new Set(assets.map((asset) => asset.name)).size !== assets.length
    )
      throw Error(
        "Unexpected or duplicate assets are attached. Resolve the draft before publishing; no asset will be overwritten.",
      );
    for (const [file, bytes] of files) {
      const current = assets.find((asset) => asset.name === file);
      if (current) {
        if (
          current.state !== "uploaded" ||
          current.size !== bytes.byteLength ||
          appSha256(github.download(name, current.id)) !== appSha256(bytes)
        )
          throw Error(
            "An existing release asset differs from the exact package. It will not be overwritten.",
          );
      } else {
        if (!release.draft)
          throw Error(
            "The published release is missing required package assets.",
          );
        const path = join(directory, file);
        await writeFile(path, bytes, { mode: 0o600 });
        github.upload(name, release.id, file, path);
      }
    }
    // Reconcile every upload from GitHub, including responses lost after acceptance.
    assets = releaseAssets(github, name, release.id);
    if (assets.length !== files.size)
      throw Error(
        "Remote release asset count differs from the package allowlist.",
      );
    for (const [file, bytes] of files) {
      const asset = assets.find((item) => item.name === file);
      if (
        !asset ||
        asset.state !== "uploaded" ||
        asset.size !== bytes.byteLength ||
        appSha256(github.download(name, asset.id)) !== appSha256(bytes)
      )
        throw Error(
          "Remote release asset verification failed; the draft remains recoverable.",
        );
    }
    assertSource();
    verifyReleaseTag(github, name, tag, source.commit, false);
    if (release.draft)
      github.json(`repos/${name}/releases/${release.id}`, "PATCH", {
        draft: false,
        make_latest: "true",
      });
    release = githubReleaseSchema.parse(
      github.json(`repos/${name}/releases/${release.id}`),
    );
    if (release.draft || release.immutable !== true || release.tag_name !== tag)
      throw Error(
        "GitHub has not confirmed immutable publication. Rerun the same command to reconcile.",
      );
    const publishedAssets = releaseAssets(github, name, release.id);
    if (publishedAssets.length !== files.size)
      throw Error("The immutable asset allowlist differs from this package.");
    for (const [file, bytes] of files) {
      const asset = publishedAssets.find((item) => item.name === file);
      if (
        !asset ||
        asset.state !== "uploaded" ||
        asset.size !== bytes.byteLength ||
        appSha256(github.download(name, asset.id)) !== appSha256(bytes)
      )
        throw Error(
          "Immutable package bytes differ. Publication is not verified.",
        );
    }
    verifyReleaseTag(github, name, tag, source.commit);
    state = { ...state, phase: "published" };
    await saveReleaseState(directory, state);
    return {
      status: "published",
      repositoryUrl: `https://github.com/${name}`,
      releaseUrl: release.html_url,
      version,
      sourceCommit: source.commit,
      artifactSha256: built.artifactSha256,
      manifestSha256: built.manifestSha256,
      conformance,
      discovery:
        "Add the anvil-app repository topic when ready, then refresh Anvil Market. Publication never installs the App or grants an agent access.",
    };
  } finally {
    await unlock();
  }
}

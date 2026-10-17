import { createHash, randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { mkdir, lstat, open, rename, rm, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import {
  appDevelopmentProjectSchema,
  appDevelopmentTokenSchema,
  appStartPairingSchema,
  appPreviewOverviewSchema,
} from "../contracts/apps/index.js";
import { developmentOrigin } from "./development-http.js";

export type DevelopmentTarget = {
  version: 1;
  origin: string;
  projectKey: string;
  secret: string;
} & (
  | { phase: "pairing"; requestId: string; nonce: string }
  | { phase: "connected"; previewId: string }
);
function parseTarget(input: unknown): DevelopmentTarget {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error();
  const data = input as Record<string, unknown>;
  const expected = [
    "version",
    "origin",
    "projectKey",
    "secret",
    "phase",
    ...(data.phase === "pairing" ? ["requestId", "nonce"] : ["previewId"]),
  ];
  if (
    data.version !== 1 ||
    Object.keys(data).some((key) => !expected.includes(key))
  )
    throw Error();
  const base = {
    version: 1 as const,
    origin: developmentOrigin(String(data.origin)),
    projectKey: appDevelopmentProjectSchema.parse(data.projectKey),
    secret: appDevelopmentTokenSchema.parse(data.secret),
  };
  if (data.phase === "pairing")
    return {
      ...base,
      phase: "pairing",
      requestId: appStartPairingSchema.shape.requestId.parse(data.requestId),
      nonce: appDevelopmentTokenSchema.parse(data.nonce),
    };
  if (data.phase === "connected")
    return {
      ...base,
      phase: "connected",
      previewId: appPreviewOverviewSchema.shape.id.parse(data.previewId),
    };
  throw Error();
}
function privateMode(stat: Stats) {
  return (
    process.platform === "win32" ||
    (stat.uid === process.getuid?.() && (stat.mode & 0o077) === 0)
  );
}
export function developmentConfigDirectory() {
  const xdg = process.env.XDG_CONFIG_HOME;
  return join(
    xdg && isAbsolute(xdg) ? xdg : join(homedir(), ".config"),
    "anvil",
    "apps",
  );
}
export class DevelopmentConfig {
  private constructor(
    readonly projectKey: string,
    readonly path: string,
  ) {}
  static async forProject(
    project: string,
    projectKey: string,
    directory = developmentConfigDirectory(),
  ) {
    appDevelopmentProjectSchema.parse(projectKey);
    const root = await realpath(project);
    const configRoot = join(directory, "targets");
    const relativeConfig = relative(root, configRoot);
    if (
      !relativeConfig ||
      (!relativeConfig.startsWith(`..${sep}`) &&
        relativeConfig !== ".." &&
        !isAbsolute(relativeConfig))
    )
      throw Error(
        "Development credentials must be stored outside the author project.",
      );
    await mkdir(configRoot, { recursive: true, mode: 0o700 });
    const stat = await lstat(configRoot);
    if (!stat.isDirectory() || !privateMode(stat))
      throw Error(
        "The Anvil development config directory must be private and cannot be a symlink.",
      );
    const canonicalRelative = relative(root, await realpath(configRoot));
    if (
      !canonicalRelative ||
      (!canonicalRelative.startsWith(`..${sep}`) &&
        canonicalRelative !== ".." &&
        !isAbsolute(canonicalRelative))
    )
      throw Error(
        "Development credentials must be stored outside the author project.",
      );
    const id = createHash("sha256")
      .update(JSON.stringify([root, projectKey]))
      .digest("hex");
    return new DevelopmentConfig(projectKey, join(configRoot, `${id}.json`));
  }
  async load(): Promise<DevelopmentTarget | null> {
    let handle;
    try {
      handle = await open(
        this.path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      const stat = await handle.stat();
      if (!stat.isFile() || !privateMode(stat) || stat.size > 8192)
        throw Error();
      const bytes = Buffer.alloc(8193);
      const { bytesRead } = await handle.read(bytes);
      if (bytesRead > 8192) throw Error();
      const target = parseTarget(
        JSON.parse(bytes.subarray(0, bytesRead).toString("utf8")),
      );
      if (target.projectKey !== this.projectKey) throw Error();
      return target;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw Error(
        "The saved Anvil development target is invalid or not private. Its credential was not used.",
      );
    } finally {
      await handle?.close();
    }
  }
  async save(target: DevelopmentTarget) {
    const validated = parseTarget(target);
    if (validated.projectKey !== this.projectKey)
      throw Error("Development project mismatch.");
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(JSON.stringify(validated) + "\n");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, this.path);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  async exclusive<T>(action: () => Promise<T>): Promise<T> {
    const lockPath = `${this.path}.lock`;
    let handle;
    try {
      handle = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      throw Error(
        `Another connection may be running. If the previous tool was killed, remove its lock only after it has stopped: ${lockPath}`,
      );
    }
    try {
      return await action();
    } finally {
      await handle.close();
      await rm(lockPath, { force: true });
    }
  }
}

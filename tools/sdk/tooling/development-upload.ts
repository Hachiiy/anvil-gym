import { constants } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { appPlatformLimits } from "../contracts/limits.js";
import {
  appDigestSchema,
  appPreviewUploadQuerySchema,
} from "../contracts/apps/index.js";
import { appSha256, canonicalAppJson } from "../src/package.js";
import type {
  DevelopmentConfig,
  DevelopmentTarget,
} from "./development-config.js";
import type { DevelopmentUploadQuery } from "./development-http.js";

export type ConnectedDevelopmentTarget = Extract<
  DevelopmentTarget,
  { phase: "connected" }
>;
export type DevelopmentUpload = {
  readonly query: DevelopmentUploadQuery;
  readonly archive: Uint8Array;
  readonly digest: string;
};
const magic = Buffer.from("ANVILUP1");
const headerBytes = 4096;
const maximum = magic.length + 4 + headerBytes + appPlatformLimits.archiveBytes;
function targetDigest(target: ConnectedDevelopmentTarget) {
  return appSha256(
    canonicalAppJson({
      origin: target.origin,
      previewId: target.previewId,
      projectKey: target.projectKey,
      credentialHash: appSha256(Buffer.from(target.secret)),
    }),
  );
}

// Exactly one bounded, private journal per project. The caller holds config.exclusive.
// A lost upload response must resume the same bytes/revision/reset, including after restart.
export class DevelopmentUploadJournal {
  readonly path: string;
  constructor(config: DevelopmentConfig) {
    this.path = `${config.path}.upload`;
  }
  async load(
    target: ConnectedDevelopmentTarget,
  ): Promise<DevelopmentUpload | null> {
    let handle;
    try {
      handle = await open(
        this.path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      const stat = await handle.stat();
      if (
        !stat.isFile() ||
        stat.size < 13 ||
        stat.size > maximum ||
        (process.platform !== "win32" &&
          (stat.uid !== process.getuid?.() || stat.mode & 0o077))
      )
        throw Error();
      const buffer = Buffer.alloc(stat.size + 1);
      let size = 0;
      while (size < buffer.length) {
        const { bytesRead } = await handle.read(
          buffer,
          size,
          buffer.length - size,
        );
        if (!bytesRead) break;
        size += bytesRead;
      }
      if (size !== stat.size || !buffer.subarray(0, 8).equals(magic))
        throw Error();
      const length = buffer.readUInt32BE(8);
      if (!length || length > headerBytes || 12 + length >= size) throw Error();
      const metadata: unknown = JSON.parse(
        buffer.subarray(12, 12 + length).toString("utf8"),
      );
      if (
        !metadata ||
        typeof metadata !== "object" ||
        Array.isArray(metadata) ||
        Object.keys(metadata).sort().join(",") !==
          "digest,query,target,version" ||
        !("version" in metadata) ||
        metadata.version !== 1 ||
        !("target" in metadata) ||
        metadata.target !== targetDigest(target) ||
        !("query" in metadata) ||
        !("digest" in metadata)
      )
        throw Error();
      const archive = buffer.subarray(12 + length, size);
      if (archive.byteLength > appPlatformLimits.archiveBytes) throw Error();
      const digest = appDigestSchema.parse(metadata.digest);
      if (appSha256(archive) !== digest) throw Error();
      return {
        archive,
        digest,
        query: appPreviewUploadQuerySchema.parse(metadata.query),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw Error(
        "The pending upload is invalid, not private or belongs to another target. Inspect the preview before using dev --discard-pending; no upload was sent.",
      );
    } finally {
      await handle?.close();
    }
  }
  async save(
    target: ConnectedDevelopmentTarget,
    query: DevelopmentUploadQuery,
    input: Uint8Array,
  ): Promise<DevelopmentUpload> {
    if (!input.byteLength || input.byteLength > appPlatformLimits.archiveBytes)
      throw Error("Invalid development upload bounds.");
    const archive = Buffer.from(input),
      digest = appSha256(archive);
    const parsed = appPreviewUploadQuerySchema.parse(query);
    const metadata = Buffer.from(
      JSON.stringify({
        version: 1,
        target: targetDigest(target),
        query: parsed,
        digest,
      }),
    );
    if (metadata.byteLength > headerBytes)
      throw Error("Invalid upload journal metadata.");
    const prefix = Buffer.alloc(12);
    magic.copy(prefix);
    prefix.writeUInt32BE(metadata.byteLength, 8);
    const temporary = `${this.path}.tmp`;
    // A killed writer can leave at most this single temp file; the exclusive lock
    // must have been deliberately recovered before another writer can get here.
    await rm(temporary, { force: true });
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(Buffer.concat([prefix, metadata, archive]));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, this.path);
    } finally {
      await rm(temporary, { force: true });
    }
    return { archive, digest, query: parsed };
  }
  discard() {
    return rm(this.path, { force: true });
  }
}

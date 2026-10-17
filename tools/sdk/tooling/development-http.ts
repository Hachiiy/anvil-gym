import { browserHttpRoute } from "../contracts/development-http.js";
import { appPlatformLimits, appPreviewLimits } from "../contracts/limits.js";
import {
  appPreviewDetailsSchema,
  appPreviewUploadQuerySchema,
} from "../contracts/apps/index.js";

export class DevelopmentHttpError extends Error {
  constructor(readonly status: number) {
    super(
      status >= 300 && status < 400
        ? "Anvil redirected the development request. Check the configured origin and gateway."
        : `Anvil rejected the development request (HTTP ${status}).`,
    );
  }
}

export function developmentOrigin(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw Error("Enter a complete HTTPS Anvil origin.");
  }
  if (
    ![url.origin, url.origin + "/"].includes(input.trim()) ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw Error(
      "Use an HTTPS origin without a path, credentials, query or fragment. HTTP is allowed only on loopback.",
    );
  return url.origin;
}

export type DevelopmentFetch = typeof fetch;
type Operation =
  | "startAppDevelopmentPairing"
  | "exchangeAppDevelopmentPairing"
  | "recoverAppDevelopmentPairing"
  | "pairedAppPreview";
export type DevelopmentUploadQuery = ReturnType<
  typeof appPreviewUploadQuerySchema.parse
>;

// No cookie jar, redirect following, server diagnostics or credential-bearing URLs.
export class DevelopmentHttp {
  constructor(
    readonly origin: string,
    private readonly fetcher: DevelopmentFetch = fetch,
    private readonly signal?: AbortSignal,
  ) {
    developmentOrigin(origin);
  }
  async request<T>(
    operation: Operation,
    token: string,
    parse: (input: unknown) => T,
    id?: string,
    body?: unknown,
  ): Promise<T> {
    return this.send(
      operation,
      token,
      parse,
      id,
      body === undefined
        ? undefined
        : {
            body: JSON.stringify(body),
            contentType: "application/json",
          },
    );
  }
  upload(
    id: string,
    token: string,
    query: DevelopmentUploadQuery,
    archive: Uint8Array,
  ) {
    const parsed = appPreviewUploadQuerySchema.parse(query);
    if (
      !archive.byteLength ||
      archive.byteLength > appPlatformLimits.archiveBytes
    )
      throw Error("Invalid development upload bounds.");
    const search = new URLSearchParams([
      ["generation", String(parsed.generation)],
      ["revision", String(parsed.revision)],
      ["mode", parsed.mode],
    ]);
    return this.send(
      "uploadAppPreview",
      token,
      (input) => appPreviewDetailsSchema.parse(input),
      id,
      {
        body: new Uint8Array(archive),
        contentType: "application/octet-stream",
        query: search.toString(),
      },
    );
  }
  private async send<T>(
    operation: Operation | "uploadAppPreview",
    token: string,
    parse: (input: unknown) => T,
    id: string | undefined,
    content?: { body: BodyInit; contentType: string; query?: string },
  ): Promise<T> {
    const route = browserHttpRoute(operation);
    const path = route.path.replace(":id", encodeURIComponent(id ?? ""));
    const timeout = AbortSignal.timeout(
      operation === "uploadAppPreview"
        ? (appPreviewLimits.uploadSeconds + 5) * 1000
        : 10000,
    );
    try {
      const response = await this.fetcher(
        `${this.origin}/api/${path}${content?.query ? "?" + content.query : ""}`,
        {
          method: route.method,
          redirect: "manual",
          credentials: "omit",
          cache: "no-store",
          signal: this.signal
            ? AbortSignal.any([this.signal, timeout])
            : timeout,
          headers: {
            authorization: `Bearer ${token}`,
            origin: this.origin,
            "x-anvil-request": "1",
            accept: "application/json",
            ...(content ? { "content-type": content.contentType } : {}),
          },
          ...(content ? { body: content.body } : {}),
        },
      );
      if (response.status !== route.status) {
        await response.body?.cancel();
        throw new DevelopmentHttpError(response.status);
      }
      if (
        !/^application\/json(?:\s*;|$)/i.test(
          response.headers.get("content-type") ?? "",
        ) ||
        !response.body
      )
        throw Error("Invalid development response.");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 1024 * 1024)
            throw Error("Oversized development response.");
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
        reader.releaseLock();
      }
      return parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch (error) {
      if (this.signal?.aborted)
        throw Error(
          "Development connection cancelled. Run connect again to resume.",
        );
      if (error instanceof DevelopmentHttpError) throw error;
      throw Error(
        "Could not read a valid Anvil development response. Check connectivity and TLS trust, then run connect again to resume.",
      );
    }
  }
}

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { appPreviewLimits } from "../contracts/limits.js";
import {
  appPairingSchema,
  appPairingExchangeSchema,
  appPreviewDetailsSchema,
  type AppPreviewOverview,
} from "../contracts/apps/index.js";
import {
  DevelopmentConfig,
  type DevelopmentTarget,
} from "./development-config.js";
import {
  DevelopmentHttp,
  DevelopmentHttpError,
  developmentOrigin,
  type DevelopmentFetch,
} from "./development-http.js";

export type DevelopmentConnectionOptions = {
  origin?: string;
  fresh?: boolean;
  signal?: AbortSignal;
  fetcher?: DevelopmentFetch;
  log: (message: string) => void;
  open: (url: string) => Promise<void>;
  promptOrigin: () => Promise<string>;
  pause?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
};
export async function connectDevelopment(
  config: DevelopmentConfig,
  options: DevelopmentConnectionOptions,
) {
  return config.exclusive(async () => {
    const saved = await config.load();
    const origin = developmentOrigin(
      options.origin ?? saved?.origin ?? (await options.promptOrigin()),
    );
    if (saved && saved.origin !== origin && !options.fresh)
      throw Error(
        "This project is paired to a different Anvil origin. Use --new to authorize a replacement target.",
      );
    const timeout = AbortSignal.timeout(appPreviewLimits.pairingSeconds * 1000);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;
    const http = new DevelopmentHttp(origin, options.fetcher, signal);
    if (saved?.phase === "connected" && !options.fresh) {
      let preview;
      try {
        preview = await http.request(
          "pairedAppPreview",
          saved.secret,
          (input) => appPreviewDetailsSchema.parse(input),
          saved.previewId,
        );
      } catch (error) {
        if (
          error instanceof DevelopmentHttpError &&
          [401, 403, 404].includes(error.status)
        )
          throw Error(
            "Saved preview access expired or was stopped. Use connect with --new to authorize a new preview.",
          );
        throw error;
      }
      if (
        !preview.active ||
        preview.id !== saved.previewId ||
        preview.projectKey !== config.projectKey
      )
        throw Error(
          "The saved preview does not match this project or is no longer active. Use connect with --new.",
        );
      options.log("Connected to the saved development preview.");
      return { target: saved, preview, reused: true };
    }
    const target: Extract<DevelopmentTarget, { phase: "pairing" }> =
      saved?.phase === "pairing" && !options.fresh
        ? saved
        : {
            version: 1,
            phase: "pairing",
            origin,
            projectKey: config.projectKey,
            requestId: randomUUID(),
            nonce: randomBytes(32).toString("base64url"),
            secret: randomBytes(32).toString("base64url"),
          };
    // Persist before any network effect, including a possibly lost start/exchange response.
    await config.save(target);
    const finish = async (preview: AppPreviewOverview) => {
      if (!preview.active || preview.projectKey !== target.projectKey)
        throw Error(
          "Anvil returned a preview for a different project or an inactive preview.",
        );
      const connected: DevelopmentTarget = {
        version: 1,
        phase: "connected",
        origin,
        projectKey: target.projectKey,
        secret: target.secret,
        previewId: preview.id,
      };
      await config.save(connected);
      options.log("Development preview connected.");
      return { target: connected, preview, reused: false };
    };
    const recover = async () => {
      try {
        const result = await http.request(
          "recoverAppDevelopmentPairing",
          target.secret,
          (input) => appPairingExchangeSchema.parse(input),
          target.requestId,
        );
        return result.state === "paired" ? result.preview : null;
      } catch (error) {
        if (
          error instanceof DevelopmentHttpError &&
          [403, 404].includes(error.status)
        )
          return null;
        throw error;
      }
    };
    if (saved?.phase === "pairing" && !options.fresh) {
      const recovered = await recover();
      if (recovered) return finish(recovered);
    }
    const pairing = await http.request(
      "startAppDevelopmentPairing",
      target.nonce,
      (input) => appPairingSchema.parse(input),
      undefined,
      {
        requestId: target.requestId,
        projectKey: target.projectKey,
        credentialHash: createHash("sha256")
          .update(target.secret)
          .digest("hex"),
      },
    );
    if (
      pairing.id !== target.requestId ||
      pairing.projectKey !== target.projectKey
    )
      throw Error("Anvil returned a different development pairing.");
    const link = `${origin}/apps/development/pair/${target.requestId}`;
    options.log(`Authorize this project in Anvil: ${link}`);
    await options.open(link);
    const pause =
      options.pause ??
      ((milliseconds, stop) =>
        setTimeout(milliseconds, undefined, { signal: stop }));
    while (!signal.aborted) {
      try {
        const result = await http.request(
          "exchangeAppDevelopmentPairing",
          target.nonce,
          (input) => appPairingExchangeSchema.parse(input),
          target.requestId,
        );
        if (result.state === "paired") return finish(result.preview);
        if (result.state !== "pending")
          throw Error(
            `Development pairing ${result.state}. Use connect with --new to start a new request.`,
          );
        if (Date.parse(result.expiresAt) <= Date.now())
          throw Error(
            "Development pairing expired. Use connect with --new to start a new request.",
          );
      } catch (error) {
        // A committed exchange can lose its response. Recovery uses the retained
        // preview proof; it never repeats an owner approval or creates another preview.
        const recovered = await recover();
        if (recovered) return finish(recovered);
        throw error;
      }
      try {
        await pause(2000, signal);
      } catch (error) {
        if (!signal.aborted) throw error;
      }
    }
    throw Error(
      "Development pairing cancelled or timed out. Run connect again to resume.",
    );
  });
}

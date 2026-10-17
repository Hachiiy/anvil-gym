import { setTimeout as pause } from "node:timers/promises";
import { setImmediate as turn } from "node:timers/promises";
import {
  appPreviewDetailsSchema,
  type AppPreviewDetails,
} from "../contracts/apps/index.js";
import type { buildAppPackage } from "../src/package.js";
import type { DevelopmentConfig } from "./development-config.js";
import { DevelopmentHttp, DevelopmentHttpError } from "./development-http.js";
import type { DevelopmentConnectionOptions } from "./development-connect.js";
import {
  DevelopmentUploadJournal,
  type ConnectedDevelopmentTarget,
  type DevelopmentUpload,
} from "./development-upload.js";

export type DevelopmentWatchOptions = DevelopmentConnectionOptions & {
  reset?: boolean;
  discardPending?: boolean;
};
export interface DevelopmentWatchPorts {
  build: () => Promise<ReturnType<typeof buildAppPackage>>;
  watch: (
    changed: () => void,
    failed: (error: Error) => void,
  ) => Promise<{ close: () => void }>;
  ready: (preview: AppPreviewDetails) => Promise<void>;
}
class RejectedDevelopmentBuild extends Error {}

// The caller retains the project's exclusive config lock for this entire loop.
export async function watchDevelopment(
  config: DevelopmentConfig,
  target: ConnectedDevelopmentTarget,
  ports: DevelopmentWatchPorts,
  options: DevelopmentWatchOptions,
) {
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  const http = new DevelopmentHttp(target.origin, options.fetcher, signal);
  const journal = new DevelopmentUploadJournal(config);
  let watcher: Awaited<ReturnType<DevelopmentWatchPorts["watch"]>> | undefined;
  let epoch = 0,
    queued = false,
    wake: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined,
    failure: Error | undefined;
  let reset = options.reset === true,
    opened = false;
  const changed = () => {
    if (signal.aborted) return;
    epoch++;
    clearTimeout(timer);
    timer = setTimeout(() => {
      queued = true;
      wake?.();
      wake = undefined;
    }, 200);
  };
  const stopped = () => {
    clearTimeout(timer);
    wake?.();
    wake = undefined;
  };
  signal.addEventListener("abort", stopped, { once: true });
  const ready = async (preview: AppPreviewDetails) => {
    options.log(`Preview ready, revision ${preview.revision}.`);
    if (!opened) {
      opened = true;
      await ports.ready(preview);
    }
  };
  const checked = (preview: AppPreviewDetails) => {
    if (
      !preview.active ||
      preview.id !== target.previewId ||
      preview.projectKey !== target.projectKey
    )
      throw Error(
        "The development preview is no longer the authorized target. Use dev --new for explicit replacement consent.",
      );
    return preview;
  };
  const upload = async (pending: DevelopmentUpload, recovering: boolean) => {
    let uncertain = recovering;
    for (let attempt = 0; attempt < 3; attempt++) {
      signal.throwIfAborted();
      try {
        const preview = checked(
          await http.upload(
            target.previewId,
            target.secret,
            pending.query,
            pending.archive,
          ),
        );
        if (
          preview.revision !== pending.query.revision ||
          preview.generation !== pending.query.generation + 1 ||
          preview.packageDigest !== pending.digest
        )
          throw Error(
            "The upload response does not identify the exact pending build.",
          );
        await journal.discard();
        if (pending.query.mode === "reset") reset = false;
        await ready(preview);
        return;
      } catch (error) {
        if (signal.aborted) throw error;
        if (error instanceof DevelopmentHttpError) {
          if (!uncertain && [400, 409, 413, 415, 422].includes(error.status)) {
            await journal.discard();
            throw new RejectedDevelopmentBuild(
              `Anvil rejected this build (HTTP ${error.status}); the accepted preview was retained. A changed data schema requires an explicit dev --reset.`,
            );
          }
          if (error.status < 500 && ![408, 429].includes(error.status)) break;
        }
        uncertain = true;
        if (attempt < 2) {
          options.log(
            "Upload response unavailable; recovering the exact pending build.",
          );
          if (options.pause) await options.pause(500 * (attempt + 1), signal);
          else await pause(500 * (attempt + 1), undefined, { signal });
        }
      }
    }
    throw Error(
      "The upload outcome could not be confirmed. Its exact bytes and reset request remain private. Run dev again to recover; inspect the preview before using --discard-pending or --new.",
    );
  };
  try {
    if (options.discardPending || options.fresh) {
      await journal.discard();
      options.log(
        "Local pending upload recovery was explicitly skipped; existing server preview data was retained.",
      );
    }
    const pending = await journal.load(target);
    watcher = await ports.watch(changed, (error) => {
      failure = error;
      controller.abort();
    });
    if (pending) {
      options.log(
        "Recovering the saved exact upload before building newer source.",
      );
      await upload(pending, true);
    }
    changed();
    options.log(
      "Watching author files. Ctrl+C stops this tool and retains the preview.",
    );
    while (!signal.aborted) {
      if (!queued)
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      if (signal.aborted) break;
      queued = false;
      const observed = epoch;
      options.log("Building locally...");
      let built: Awaited<ReturnType<DevelopmentWatchPorts["build"]>>;
      try {
        built = await ports.build();
      } catch (error) {
        if (observed === epoch && !signal.aborted)
          options.log(
            `Build failed; the accepted preview was retained.\n${error instanceof Error ? error.message : "Check author source and assets."}`,
          );
        continue;
      }
      // Filesystem events queued during synchronous typechecking must run before
      // the epoch check. A superseded build never starts a network mutation.
      await turn();
      if (observed !== epoch || signal.aborted) continue;
      const preview = checked(
        await http.request(
          "pairedAppPreview",
          target.secret,
          (input) => appPreviewDetailsSchema.parse(input),
          target.previewId,
        ),
      );
      if (observed !== epoch || signal.aborted) continue;
      if (!reset && preview.packageDigest === built.artifactSha256) {
        await ready(preview);
        continue;
      }
      const next = await journal.save(
        target,
        {
          generation: preview.generation,
          revision: preview.revision + 1,
          mode: reset ? "reset" : "preserve",
        },
        built.archive,
      );
      if (observed !== epoch || signal.aborted) {
        await journal.discard();
        continue;
      }
      try {
        await upload(next, false);
      } catch (error) {
        if (error instanceof RejectedDevelopmentBuild)
          options.log(error.message);
        else throw error;
      }
    }
    if (failure) throw failure;
    return {
      status: "stopped",
      origin: target.origin,
      previewId: target.previewId,
    };
  } catch (error) {
    if (failure) throw failure;
    if (!options.signal?.aborted) throw error;
    return {
      status: "stopped",
      origin: target.origin,
      previewId: target.previewId,
    };
  } finally {
    controller.abort();
    signal.removeEventListener("abort", stopped);
    stopped();
    watcher?.close();
  }
}

import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { DevelopmentConfig } from "./development-config.js";
import {
  connectDevelopment,
  type DevelopmentConnectionOptions,
} from "./development-connect.js";
import { readDevelopmentProject } from "./author-project.js";

async function openBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "rundll32"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  // The printed link remains usable when a browser opener is unavailable.
  await new Promise<void>((done) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    });
    child.once("error", () => done());
    child.once("spawn", () => {
      child.unref();
      done();
    });
  });
}

export async function runDevelopmentCommand(args: string[]) {
  const fresh = args.at(-1) === "--new";
  const positional = fresh ? args.slice(0, -1) : args;
  const [directory, origin] = positional;
  if (
    !directory ||
    positional.length > 2 ||
    positional.some((value) => value.startsWith("--"))
  )
    throw Error(
      "Usage: anvil-app connect <project> [https://anvil.example] [--new]",
    );
  return withDevelopmentTarget(
    directory,
    origin,
    fresh,
    async (config, options) => {
      const connected = await connectDevelopment(config, options);
      return {
        status: "connected",
        origin: connected.target.origin,
        previewId: connected.preview.id,
        reused: connected.reused,
      };
    },
  );
}

export async function withDevelopmentTarget<T>(
  directory: string,
  origin: string | undefined,
  fresh: boolean,
  run: (
    config: DevelopmentConfig,
    options: DevelopmentConnectionOptions,
    project: string,
  ) => Promise<T>,
) {
  const { project, projectKey } = await readDevelopmentProject(directory);
  const config = await DevelopmentConfig.forProject(project, projectKey);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    return await run(
      config,
      {
        origin,
        fresh,
        signal: controller.signal,
        log: (message) => process.stdout.write(message + "\n"),
        open: openBrowser,
        promptOrigin: async () => {
          if (!process.stdin.isTTY)
            throw Error(
              "Pass the HTTPS Anvil origin on first use: anvil-app connect <project> <origin>.",
            );
          const prompt = createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          try {
            return await prompt.question("Anvil origin: ", {
              signal: controller.signal,
            });
          } finally {
            prompt.close();
          }
        },
      },
      project,
    );
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

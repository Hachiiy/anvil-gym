import type { build } from "esbuild";
import { withDevelopmentTarget } from "./development-command.js";
import { connectDevelopment } from "./development-connect.js";
import { watchDevelopment } from "./development-watch.js";
import { readAuthorPackage } from "./author-project.js";
import { AuthorWatcher } from "./author-watch.js";

export async function runDevelopmentWatchCommand(
  args: string[],
  compile: typeof build,
) {
  const flags = new Set(args.filter((value) => value.startsWith("--")));
  const positional = args.filter((value) => !value.startsWith("--"));
  const [directory, origin] = positional;
  if (
    !directory ||
    positional.length > 2 ||
    flags.size !== args.length - positional.length ||
    [...flags].some(
      (flag) => !["--new", "--reset", "--discard-pending"].includes(flag),
    )
  )
    throw Error(
      "Usage: anvil-app dev <project> [https://anvil.example] [--new] [--reset] [--discard-pending]",
    );
  return withDevelopmentTarget(
    directory,
    origin,
    flags.has("--new"),
    async (config, options, project) => {
      const connection = await connectDevelopment(config, options);
      return config.exclusive(async () => {
        const target = await config.load();
        if (
          target?.phase !== "connected" ||
          target.origin !== connection.target.origin ||
          target.secret !== connection.target.secret ||
          target.previewId !== connection.preview.id
        )
          throw Error(
            "The saved target changed before dev acquired its lock. Run dev again.",
          );
        let opened = false;
        return watchDevelopment(
          config,
          target,
          {
            build: () => readAuthorPackage(project, compile),
            watch: async (changed, failed) => {
              const watcher = new AuthorWatcher(project, changed, failed);
              try {
                await watcher.start();
                return watcher;
              } catch (error) {
                watcher.close();
                throw error;
              }
            },
            ready: async () => {
              if (opened) return;
              opened = true;
              const link = `${target.origin}/apps/development/previews/${target.previewId}`;
              options.log(`Open the native preview in Anvil: ${link}`);
              await options.open(link);
            },
          },
          {
            ...options,
            reset: flags.has("--reset"),
            discardPending: flags.has("--discard-pending"),
          },
        );
      });
    },
  );
}

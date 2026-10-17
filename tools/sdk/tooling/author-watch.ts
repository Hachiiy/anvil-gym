import { watch, type FSWatcher } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const ignored = (path: string) => {
  const parts = path.split(sep);
  return (
    parts.some((part) => ["node_modules", ".git", ".cache"].includes(part)) ||
    (parts[0] === "tools" && parts[1] === "sdk")
  );
};

// No server or inbound port. Watch ordinary author files, including new folders,
// without allocating watchers for installed dependencies or the SDK snapshot.
export class AuthorWatcher {
  private readonly watchers = new Map<
    string,
    { watcher: FSWatcher; identity: string }
  >();
  private closed = false;
  private scanning?: Promise<void>;
  private again = false;
  constructor(
    private readonly project: string,
    private readonly changed: () => void,
    private readonly failed: (error: Error) => void,
  ) {}
  async start() {
    await this.scan();
  }
  close() {
    this.closed = true;
    for (const { watcher } of this.watchers.values()) watcher.close();
    this.watchers.clear();
  }
  private scan(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.scanning) {
      this.again = true;
      return this.scanning;
    }
    const pending = this.collect().finally(() => {
      this.scanning = undefined;
    });
    this.scanning = pending;
    return pending;
  }
  private async collect() {
    do {
      this.again = false;
      const directories = new Set<string>();
      const visit = async (path: string) => {
        if (this.closed) return;
        if (directories.size >= 512)
          throw Error(
            "The author project exceeds the 512-directory watcher bound. Keep generated dependencies outside source.",
          );
        directories.add(path);
        // Watch before walking, so a newly created subdirectory cannot be lost
        // between its discovery and the next source build.
        let entries;
        try {
          const stat = await lstat(path, { bigint: true });
          if (this.closed) return;
          if (!stat.isDirectory()) {
            if (path === this.project)
              throw Error("The author project is no longer a directory.");
            directories.delete(path);
            return;
          }
          this.observe(path, `${stat.dev}:${stat.ino}`);
          entries = await readdir(path, { withFileTypes: true });
        } catch (error) {
          if (
            path !== this.project &&
            (error as NodeJS.ErrnoException).code === "ENOENT"
          ) {
            directories.delete(path);
            this.watchers.get(path)?.watcher.close();
            this.watchers.delete(path);
            return;
          }
          throw error;
        }
        for (const entry of entries) {
          const child = join(path, entry.name);
          if (entry.isDirectory() && !ignored(relative(this.project, child)))
            await visit(child);
        }
      };
      await visit(this.project);
      for (const [path, { watcher }] of this.watchers)
        if (!directories.has(path)) {
          watcher.close();
          this.watchers.delete(path);
        }
    } while (this.again && !this.closed);
  }
  private observe(path: string, identity: string) {
    const previous = this.watchers.get(path);
    if (previous?.identity === identity) return;
    previous?.watcher.close();
    const watcher = watch(path, (event, filename) => {
      if (
        this.closed ||
        (filename &&
          ignored(relative(this.project, join(path, filename.toString()))))
      )
        return;
      this.changed();
      if (event === "rename")
        void this.scan()
          .then(() => {
            if (!this.closed) this.changed();
          })
          .catch((error: unknown) => {
            if (!this.closed)
              this.failed(
                error instanceof Error
                  ? error
                  : Error("The author watcher failed."),
              );
          });
    });
    watcher.on("error", () => {
      if (!this.closed)
        this.failed(
          Error(
            "The author watcher lost filesystem access. Restart dev after checking the project.",
          ),
        );
    });
    this.watchers.set(path, { watcher, identity });
  }
}

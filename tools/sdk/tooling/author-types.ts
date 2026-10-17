import ts from "typescript";
import { join, relative } from "node:path";

export function checkAppTypes(root: string) {
  const configPath = join(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = config.error
    ? undefined
    : ts.parseJsonConfigFileContent(
        config.config,
        ts.sys,
        root,
        { noEmit: true },
        configPath,
      );
  const program = parsed && ts.createProgram(parsed.fileNames, parsed.options);
  const errors = config.error
    ? [config.error]
    : [
        ...(parsed?.errors ?? []),
        ...(program ? ts.getPreEmitDiagnostics(program) : []),
      ];
  if (errors.length)
    throw new Error(
      errors
        .slice(0, 40)
        .map((error) => {
          const location =
            error.file && error.start !== undefined
              ? error.file.getLineAndCharacterOfPosition(error.start)
              : undefined;
          const path = error.file && relative(root, error.file.fileName);
          return `${path ?? "tsconfig.json"}${location ? `:${location.line + 1}:${location.character + 1}` : ""}: ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`;
        })
        .join("\n"),
    );
}

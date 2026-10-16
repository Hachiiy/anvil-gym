import {
  parseAppManifest,
  validateAppValue,
  type AppManifest,
} from "../contracts/apps/index.js";
import { appSha256, canonicalAppJson } from "./package.js";

export async function runAppConformance(
  input: unknown,
  invoke?: (
    manifest: AppManifest,
    action: string,
    input: unknown,
  ) => Promise<unknown>,
) {
  const manifest = parseAppManifest(input);
  const cases: { action: string; passed: boolean; errors: string[] }[] = [];
  if (invoke)
    for (const fixture of manifest.fixtures) {
      const action = manifest.actions.find(
        (action) => action.name === fixture.action,
      )!;
      try {
        const value = await invoke(manifest, fixture.action, fixture.input);
        const errors = validateAppValue(action.resultSchema, value);
        if (
          JSON.stringify(value) !== JSON.stringify(fixture.expect) &&
          appSha256(canonicalAppJson(value)) !==
            appSha256(canonicalAppJson(fixture.expect))
        )
          errors.push("Result differs from the declared fixture.");
        cases.push({ action: fixture.action, passed: !errors.length, errors });
      } catch {
        cases.push({
          action: fixture.action,
          passed: false,
          errors: ["Fixture execution failed."],
        });
      }
    }
  return {
    profile: "anvil-app-conformance/1",
    packageVersion: manifest.package.version,
    manifestSha256: appSha256(canonicalAppJson(manifest)),
    format: "passed",
    behavior:
      !invoke || !cases.length
        ? "not-executed"
        : cases.every((item) => item.passed)
          ? "passed"
          : "failed",
    declaredScenarios: manifest.fixtures.length,
    cases,
    authorClaims: manifest.modelClaims,
    modelVerification: "not-executed",
    limitations: [
      "Static checks cannot prove arbitrary browser UI action completeness.",
      "No model or network call is made by this validator.",
    ],
  } as const;
}

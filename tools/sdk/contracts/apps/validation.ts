import { appManifestSchema, type AppManifest } from "./manifest.js";
import { validateAppValue } from "./json-schema.js";
import { validateAppRecipe } from "./recipe-validation.js";

import { assertAppManifestJson } from "./json.js";
import { appPlatformLimits as limits } from "../limits.js";
import { appOriginKey } from "./identity.js";
import { validateNativeView } from "./native/validation.js";

export function parseAppManifest(value: unknown): AppManifest {
  assertAppManifestJson(value);
  const manifest = appManifestSchema.parse(value);
  const errors = validateAppManifest(manifest);
  if (errors.length) throw new Error(errors.join("\n"));
  return manifest;
}

export function validateAppManifest(manifest: AppManifest): string[] {
  const errors: string[] = [];
  const unique = (names: readonly string[], label: string) => {
    if (new Set(names).size !== names.length)
      errors.push(`Duplicate ${label}.`);
  };
  const names = <T extends { name: string }>(items: T[]) =>
    items.map((item) => item.name);
  unique(names(manifest.tables), "table");
  unique(names(manifest.actions), "action");
  unique(
    manifest.integrations.map((item) => item.id),
    "integration",
  );
  unique(
    manifest.dependencies.map((item) => item.key),
    "dependency",
  );
  unique(
    manifest.dependencies.map((item) => appOriginKey(item.origin)),
    "dependency origin",
  );
  unique(
    manifest.schedules.map((item) => item.id),
    "schedule",
  );
  unique(
    manifest.ui.map((item) => item.id),
    "UI entry",
  );
  unique(
    manifest.assets.map((item) => item.path.toLowerCase()),
    "asset path",
  );
  unique(manifest.capabilities, "capability");
  if (
    manifest.package.kind === "module" &&
    manifest.ui.some((item) => item.surface === "app")
  )
    errors.push("Modules cannot expose a standalone app surface.");
  for (const table of manifest.tables) {
    unique(
      table.indexes.map((index) => JSON.stringify(index.fields)),
      `index in ${table.name}`,
    );
    for (const index of table.indexes) {
      unique(index.fields, "index field");
      if (
        index.fields.some(
          (field) => !Object.hasOwn(table.schema.properties ?? {}, field),
        )
      )
        errors.push(`Unknown index field in ${table.name}.`);
    }
    for (const reference of table.references) {
      if (
        !manifest.tables.some((item) => item.name === reference.table) ||
        table.schema.properties?.[reference.field]?.type !== "string"
      )
        errors.push(`Invalid table reference in ${table.name}.`);
    }
  }
  for (const action of manifest.actions) {
    unique(action.capabilities, "action capability");
    if (
      action.capabilities.some(
        (capability) => !manifest.capabilities.includes(capability),
      )
    )
      errors.push(`Undeclared capability in ${action.name}.`);
    errors.push(...validateAppRecipe(manifest, action));
  }
  const active = new Set<string>(),
    depths = new Map<string, number>();
  const actionMap = new Map(
    manifest.actions.map((action) => [action.name, action]),
  );
  const visit = (name: string): number => {
    if (active.has(name)) {
      errors.push(`Recursive local action graph at ${name}.`);
      return 0;
    }
    const prior = depths.get(name);
    if (prior !== undefined) return prior;
    active.add(name);
    const edges = new Set(
      (actionMap.get(name)?.recipe.steps ?? []).flatMap((step) =>
        step.op === "invoke" || step.op === "batch" ? [step.action] : [],
      ),
    );
    const depth = Math.max(0, ...[...edges].map((name) => 1 + visit(name)));
    active.delete(name);
    depths.set(name, depth);
    if (depth > limits.nestedCalls)
      errors.push("Local action graph exceeds the nested-call bound.");
    return depth;
  };
  for (const action of manifest.actions) visit(action.name);
  for (const capability of manifest.capabilities) {
    const [family, key] = capability.split(".");
    const found =
      family === "data"
        ? manifest.tables.some((item) => item.name === key)
        : family === "integration"
          ? manifest.integrations.some((item) => item.id === key)
          : family === "dependency"
            ? manifest.dependencies.some((item) => item.key === key)
            : true;
    if (!found) errors.push(`Unknown capability target: ${capability}.`);
  }
  for (const view of manifest.ui)
    errors.push(...validateNativeView(view, manifest, manifest.ui));
  for (const schedule of manifest.schedules) {
    const action = manifest.actions.find(
      (item) => item.name === schedule.action,
    );
    if (!action || validateAppValue(action.inputSchema, schedule.input).length)
      errors.push(`Invalid schedule action/input: ${schedule.id}.`);
  }
  for (const source of manifest.dataSources)
    if (
      !manifest.dependencies.some(
        (item) => item.key === source.dependency && item.kind === "app",
      )
    )
      errors.push("Data sources must name app dependencies.");
  for (const dependency of manifest.dependencies)
    if (
      Number(dependency.minimumVersion.split(".")[0]) >=
      dependency.maximumMajorExclusive
    )
      errors.push("Invalid dependency version interval.");
  for (const migration of manifest.migrations) {
    if (
      !manifest.tables.some(
        (table) =>
          table.name === migration.table &&
          table.schemaVersion >= migration.toVersion,
      ) ||
      migration.toVersion !== migration.fromVersion + 1
    )
      errors.push("Invalid migration version or target.");
  }
  unique(
    manifest.migrations.map(
      (migration) => `${migration.table}:${migration.fromVersion}`,
    ),
    "migration edge",
  );
  for (const fixture of manifest.fixtures) {
    const action = manifest.actions.find(
      (item) => item.name === fixture.action,
    );
    if (
      !action ||
      validateAppValue(action.inputSchema, fixture.input).length ||
      validateAppValue(action.resultSchema, fixture.expect).length
    )
      errors.push(`Invalid fixture for ${fixture.action}.`);
  }
  for (const claim of manifest.modelClaims)
    if (
      claim.packageVersion !== manifest.package.version ||
      !manifest.assets.some((asset) => asset.path === claim.evidence)
    )
      errors.push("Stale or missing model claim evidence.");
  return errors;
}

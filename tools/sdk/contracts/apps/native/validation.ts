import { appPlatformLimits } from "../../limits.js";
import { assertAppJson } from "../json.js";
import { validateAppValue } from "../json-schema.js";
import {
  nativeExpressionChildren,
  type NativeExpression,
} from "./expressions.js";
import {
  NativeCheckContext,
  type NativeDefinitionContext,
} from "./check-context.js";
import { checkNativeTree } from "./check-nodes.js";
import { checkNativeEvents, nativeFailureSchema } from "./check-events.js";
import { nativeViewSchema, type NativeView } from "./view.js";

function checkDependencies(view: NativeView, check: NativeCheckContext) {
  const dependencies = new Map<string, Set<string>>();
  const collect = (root: NativeExpression) => {
    const refs = new Set<string>(),
      pending = [root];
    while (pending.length) {
      const node = pending.pop()!;
      if (
        node.op === "ref" &&
        ["form", "source", "source-status"].includes(node.scope) &&
        node.name
      )
        refs.add(`${node.scope === "form" ? "form" : "source"}:${node.name}`);
      pending.push(...nativeExpressionChildren(node));
    }
    return refs;
  };
  for (const form of view.forms)
    dependencies.set(`form:${form.id}`, collect(form.initial));
  for (const source of view.sources)
    dependencies.set(`source:${source.id}`, collect(source.input));
  const active = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string) => {
    if (active.has(id)) {
      check.fail(id, "Circular form/data-source initialization.");
      return;
    }
    if (done.has(id)) return;
    active.add(id);
    for (const dependency of dependencies.get(id) ?? []) visit(dependency);
    active.delete(id);
    done.add(id);
  };
  for (const id of dependencies.keys()) visit(id);
}
export function validateNativeView(
  view: NativeView,
  definition: NativeDefinitionContext,
  views: readonly NativeView[],
): string[] {
  const check = new NativeCheckContext(view, definition, views);
  check.unique(view.actions, "actions");
  check.unique(
    view.forms.map((form) => form.id),
    "forms",
  );
  check.unique(
    view.sources.map((source) => source.id),
    "sources",
  );
  check.unique(
    view.dialogs.map((dialog) => dialog.id),
    "dialogs",
  );
  for (const action of view.actions) check.action(action, "actions");
  try {
    assertAppJson(view.state.initial, appPlatformLimits.nativeUi.stateBytes);
  } catch {
    check.fail("state.initial", "Local state exceeds its byte budget.");
  }
  if (validateAppValue(view.state.schema, view.state.initial).length)
    check.fail("state.initial", "Local state does not match its schema.");
  for (const source of view.sources) {
    const at = `source:${source.id}`,
      action = check.action(source.action, at);
    if (action?.effect !== "read")
      check.fail(at, "A view data source requires a read-only action.");
    check.assign(
      check.expression(source.input, check.scope, at),
      action?.inputSchema,
      at,
    );
  }
  for (const form of view.forms) {
    const at = `form:${form.id}`,
      action = check.action(form.action, at);
    if (form.commit === "autosave" && action?.effect !== "transaction")
      check.fail(at, "Autosave requires a transaction action.");
    const initial = check.expression(form.initial, check.scope, at);
    // Forms may begin with missing required fields. Submission uses the complete
    // declared action schema and never treats a partial draft as committed data.
    check.assign(initial, check.scope.forms.get(form.id), at);
    checkNativeEvents(
      form.onSuccess ?? [],
      { ...check.scope, event: action?.resultSchema },
      check,
      `${at}.onSuccess`,
    );
    checkNativeEvents(
      form.onFailure ?? [],
      { ...check.scope, event: nativeFailureSchema },
      check,
      `${at}.onFailure`,
    );
  }
  checkDependencies(view, check);
  checkNativeTree(check);
  return check.errors;
}
export function parseNativeViews(
  input: unknown,
  definition: NativeDefinitionContext,
): NativeView[] {
  assertAppJson(input);
  if (!Array.isArray(input) || input.length > appPlatformLimits.widgets)
    throw new Error("Invalid native view count.");
  const views = input.map((value) => nativeViewSchema.parse(value));
  if (new Set(views.map((view) => view.id)).size !== views.length)
    throw new Error("Duplicate native view identity.");
  const errors = views.flatMap((view) =>
    validateNativeView(view, definition, views),
  );
  if (errors.length)
    throw new Error(
      errors.slice(0, appPlatformLimits.nativeUi.nodes).join("\n"),
    );
  return views;
}

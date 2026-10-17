import {
  assertAppJson,
  nativeComponentMajors,
  nativeViewDefinitionSchema,
  parseAppManifest,
  type AppManifest,
  type NativeNode,
  type NativeView,
  type NativeViewDefinition,
} from "../contracts/apps/index.js";

export type {
  AppManifest,
  AppAction,
  AppTable,
  AppExpression,
  AppJsonSchema,
  NativeExpression,
  NativeEvent,
  NativeNode,
  NativeView,
  NativeViewDefinition,
} from "../contracts/apps/index.js";

export function defineView(input: NativeViewDefinition): NativeView {
  assertAppJson(input);
  const view = nativeViewDefinitionSchema.parse(input);
  const requiresComponents: Record<string, number> = {};
  const pending: NativeNode[] = [view.root, ...view.dialogs.map((d) => d.root)];
  while (pending.length) {
    const node = pending.pop()!;
    requiresComponents[node.component] = nativeComponentMajors[node.component];
    if ("children" in node) pending.push(...node.children);
    if (node.component === "list") pending.push(node.template);
    if (node.component === "condition") {
      pending.push(node.then);
      if (node.else) pending.push(node.else);
    }
  }
  return { ...view, renderer: "native", requiresComponents };
}

export function defineApp(input: AppManifest): AppManifest {
  return parseAppManifest(input);
}

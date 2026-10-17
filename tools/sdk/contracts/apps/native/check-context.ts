import { nativeDraftSchema } from "./draft-schema.js";
import { appPlatformLimits } from "../../limits.js";
import type { AppAction, AppManifest } from "../manifest.js";
import type { AppJsonSchema } from "../json-schema.js";
import { appSchemaAccepts } from "../schema-inference.js";
import type { NativeExpression } from "./expressions.js";
import type { NativeView } from "./view.js";
import { inferNativeExpression, type NativeBindingScope } from "./inference.js";

export interface NativeDefinitionContext {
  actions: readonly AppAction[];
  assets: readonly AppManifest["assets"][number][];
  capabilities: readonly string[];
}
export class NativeCheckContext {
  readonly errors: string[] = [];
  readonly actions: ReadonlyMap<string, AppAction>;
  readonly scope: NativeBindingScope;
  readonly expressionBudget = { nodes: 0 };
  constructor(
    readonly view: NativeView,
    readonly definition: NativeDefinitionContext,
    readonly views: readonly NativeView[],
  ) {
    this.actions = new Map(
      definition.actions.map((action) => [action.name, action]),
    );
    this.scope = {
      params: view.paramsSchema,
      state: view.state.schema,
      forms: new Map(
        view.forms.flatMap((form) => {
          const schema = this.actions.get(form.action)?.inputSchema;
          return schema ? [[form.id, nativeDraftSchema(schema)]] : [];
        }),
      ),
      sources: new Map(
        view.sources.flatMap((source) => {
          const schema = this.actions.get(source.action)?.resultSchema;
          return schema ? [[source.id, schema]] : [];
        }),
      ),
      items: new Map(),
    };
  }
  fail(label: string, message: string) {
    if (this.errors.length < appPlatformLimits.nativeUi.nodes)
      this.errors.push(`${this.view.id}.${label}: ${message}`);
  }
  unique(values: readonly string[], label: string) {
    if (new Set(values).size !== values.length)
      this.fail(label, "Duplicate identity.");
  }
  expression(node: NativeExpression, scope: NativeBindingScope, label: string) {
    return inferNativeExpression(
      node,
      scope,
      (message) => this.fail(label, message),
      this.expressionBudget,
    );
  }
  assign(
    value: AppJsonSchema | undefined,
    target: AppJsonSchema | undefined,
    label: string,
  ) {
    if (value && target && !appSchemaAccepts(value, target))
      this.fail(label, "Incompatible binding schema.");
  }
  expect(
    value: AppJsonSchema | undefined,
    types: AppJsonSchema["type"][],
    label: string,
  ) {
    if (value && !types.includes(value.type))
      this.fail(label, `Expected ${types.join("/")}, received ${value.type}.`);
  }
  action(name: string, label: string) {
    const action = this.actions.get(name);
    if (!action || !this.view.actions.includes(name))
      this.fail(label, `Unknown or undeclared view action: ${name}.`);
    return action;
  }
}

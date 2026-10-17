import { appPlatformLimits } from "../../limits.js";
import type { AppJsonSchema } from "../json-schema.js";
import {
  appSchemaAccepts,
  inferAppArithmetic,
  inferAppLiteral,
  mergeAppSchemas,
} from "../schema-inference.js";
import type { NativeExpression, NativeFieldPath } from "./expressions.js";

export interface NativeBindingScope {
  params: AppJsonSchema;
  state: AppJsonSchema;
  forms: ReadonlyMap<string, AppJsonSchema>;
  sources: ReadonlyMap<string, AppJsonSchema>;
  items: ReadonlyMap<string, { schema: AppJsonSchema; maxItems: number }>;
  event?: AppJsonSchema;
}
export interface NativeExpressionBudget {
  nodes: number;
}
const boolean = { type: "boolean" } as const;
const number = { type: "number" } as const;
const host: AppJsonSchema = {
  type: "object",
  properties: {
    locale: { type: "string", maxLength: 40 },
    timeZone: { type: "string", maxLength: 100 },
  },
  required: ["locale", "timeZone"],
  additionalProperties: false,
};

export function nativePathType(
  schema: AppJsonSchema | undefined,
  path: NativeFieldPath,
  scope: NativeBindingScope,
  fail: (message: string) => void,
  allowMissing = false,
): AppJsonSchema | undefined {
  for (const part of path) {
    if (typeof part === "number" || typeof part === "object") {
      const repeated =
        typeof part === "object" ? scope.items.get(part.itemIndex) : undefined;
      if (typeof part === "object" && !repeated) {
        fail(`Unknown repeated item index: ${part.itemIndex}.`);
        return;
      }
      const extent = typeof part === "number" ? part + 1 : repeated!.maxItems;
      if (schema?.type !== "array" || extent > (schema.maxItems ?? 0)) {
        fail("Field path requires an in-bounds array index.");
        return;
      }
      if (!allowMissing && extent > (schema.minItems ?? 0)) {
        fail(
          "Possibly missing array item requires a coalesce fallback; present only tests availability.",
        );
        return;
      }
      schema = schema.items;
    } else {
      if (
        schema?.type !== "object" ||
        !Object.hasOwn(schema.properties ?? {}, part)
      ) {
        fail(
          `Unknown field path: ${path.map((part) => (typeof part === "object" ? `[${part.itemIndex}]` : part)).join(".")}.`,
        );
        return;
      }
      if (!allowMissing && !schema.required?.includes(part)) {
        fail(
          "Optional binding requires a coalesce fallback; present only tests availability.",
        );
        return;
      }
      schema = schema.properties?.[part];
    }
  }
  return schema;
}

export function inferNativeExpression(
  node: NativeExpression,
  scope: NativeBindingScope,
  fail: (message: string) => void,
  budget: NativeExpressionBudget,
  depth = 0,
  allowMissing = false,
): AppJsonSchema | undefined {
  if (
    ++budget.nodes > appPlatformLimits.nativeUi.expressions ||
    depth > appPlatformLimits.nativeUi.expressionDepth
  ) {
    fail("Native expression structural budget exceeded.");
    return;
  }
  const child = (value: NativeExpression, current = scope, missing = false) =>
    inferNativeExpression(value, current, fail, budget, depth + 1, missing);
  const expect = (
    schema: AppJsonSchema | undefined,
    types: AppJsonSchema["type"][],
  ) => {
    if (schema && !types.includes(schema.type))
      fail(`Expected ${types.join("/")} expression, received ${schema.type}.`);
  };
  switch (node.op) {
    case "literal":
      return inferAppLiteral(node.value, fail);
    case "ref": {
      const named = ["form", "source", "source-status", "item"].includes(
        node.scope,
      );
      if (named !== !!node.name)
        fail(
          "Binding name must be provided only for named form/source/item scopes.",
        );
      const root =
        node.scope === "params"
          ? scope.params
          : node.scope === "state"
            ? scope.state
            : node.scope === "host"
              ? host
              : node.scope === "event"
                ? scope.event
                : node.scope === "form"
                  ? scope.forms.get(node.name!)
                  : node.scope === "item"
                    ? scope.items.get(node.name!)?.schema
                    : scope.sources.get(node.name!);
      if (!root) {
        fail(
          `Unknown binding scope: ${node.scope}${node.name ? `:${node.name}` : ""}.`,
        );
        return;
      }
      if (node.scope === "source-status") {
        if (node.path.length) fail("Source status has no property path.");
        return {
          type: "string",
          maxLength: 7,
          enum: ["idle", "loading", "ready", "error"],
        };
      }
      return nativePathType(root, node.path, scope, fail, allowMissing);
    }
    case "object": {
      const properties: Record<string, AppJsonSchema> = {};
      for (const [key, value] of Object.entries(node.fields)) {
        const schema = child(value);
        if (schema) properties[key] = schema;
      }
      return {
        type: "object",
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
      };
    }
    case "array": {
      const items = node.items
        .map((value) => child(value))
        .reduce((left, right) => mergeAppSchemas(left, right, fail), undefined);
      return {
        type: "array",
        items,
        minItems: node.items.length,
        maxItems: node.items.length,
      };
    }
    case "not":
      expect(child(node.value), ["boolean"]);
      return boolean;
    case "present":
      child(node.value, scope, true);
      return boolean;
    case "length":
      expect(child(node.value), ["array", "string"]);
      return {
        type: "integer",
        minimum: 0,
        maximum: appPlatformLimits.inputBytes,
      };
    case "if": {
      expect(child(node.condition), ["boolean"]);
      return mergeAppSchemas(child(node.then), child(node.else), fail);
    }
    case "map":
    case "filter": {
      const source = child(node.source);
      expect(source, ["array"]);
      if (!source?.items) {
        fail("A repeated expression requires known array items.");
        return;
      }
      if (scope.items.has(node.as))
        fail(`Repeated item name shadows an outer binding: ${node.as}.`);
      const value = child(node.value, {
        ...scope,
        items: new Map([
          ...scope.items,
          [
            node.as,
            {
              schema: source.items,
              maxItems: Math.min(
                source.maxItems ?? node.maxItems,
                node.maxItems,
              ),
            },
          ],
        ]),
      });
      if (node.op === "filter") expect(value, ["boolean"]);
      return {
        type: "array",
        items: node.op === "filter" ? source.items : value,
        maxItems: Math.min(source.maxItems ?? node.maxItems, node.maxItems),
      };
    }
    case "append": {
      const source = child(node.source),
        value = child(node.value);
      expect(source, ["array"]);
      if (source?.items && value && !appSchemaAccepts(value, source.items))
        fail("Appended item has an incompatible schema.");
      return {
        type: "array",
        items: source?.items ?? value,
        maxItems: node.maxItems,
      };
    }
    case "remove-at": {
      const source = child(node.source);
      expect(source, ["array"]);
      expect(child(node.index), ["integer"]);
      return source?.type === "array"
        ? {
            ...source,
            minItems: 0,
            maxItems: Math.min(source.maxItems ?? node.maxItems, node.maxItems),
          }
        : undefined;
    }
    case "format":
      expect(
        child(node.value),
        node.format === "number" ? ["integer", "number"] : ["string"],
      );
      return { type: "string", maxLength: 200 };
    default: {
      const left = child(node.left, scope, node.op === "coalesce"),
        right = child(node.right);
      if (node.op === "less" || node.op === "greater") {
        expect(left, ["integer", "number"]);
        expect(right, ["integer", "number"]);
        return boolean;
      }
      if (
        node.op === "add" ||
        node.op === "subtract" ||
        node.op === "multiply" ||
        node.op === "divide"
      ) {
        expect(left, ["integer", "number"]);
        expect(right, ["integer", "number"]);
        return inferAppArithmetic(node.op, left, right);
      }
      if (node.op === "and" || node.op === "or") {
        expect(left, ["boolean"]);
        expect(right, ["boolean"]);
        return boolean;
      }
      if (node.op === "equal") return boolean;
      if (node.op === "coalesce") {
        if (left?.type === "null") return right;
        return mergeAppSchemas(left, right, fail);
      }
      expect(left, ["string"]);
      expect(right, ["string"]);
      return {
        type: "string",
        maxLength:
          (left?.maxLength ?? appPlatformLimits.inputBytes) +
          (right?.maxLength ?? appPlatformLimits.inputBytes),
      };
    }
  }
}

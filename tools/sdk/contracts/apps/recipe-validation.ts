import { appPlatformLimits as limits } from "../limits.js";
import type { AppAction, AppManifest } from "./manifest.js";
import type { AppExpression } from "./recipe.js";
import type { AppJsonSchema } from "./json-schema.js";
import { appUnits } from "./units.js";
import {
  appSchemaAccepts,
  inferAppLiteral,
  mergeAppSchemas,
  inferAppArithmetic,
} from "./schema-inference.js";

export function validateAppRecipe(
  manifest: AppManifest,
  action: AppAction,
): string[] {
  const errors: string[] = [];
  const prior = new Map<string, AppJsonSchema | undefined>();
  let nodes = action.recipe.steps.length;
  const fail = (message: string) => errors.push(`${action.name}: ${message}`);
  const string = { type: "string", maxLength: limits.inputBytes } as const;
  const id = { type: "string", minLength: 36, maxLength: 36 } as const;
  const number = { type: "number" } as const;
  const boolean = { type: "boolean" } as const;
  const object = (
    properties: Record<string, AppJsonSchema>,
  ): AppJsonSchema => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  });
  const field = (schema: AppJsonSchema | undefined, path: string[]) => {
    for (const key of path) {
      if (
        !schema ||
        schema.type !== "object" ||
        !Object.hasOwn(schema.properties ?? {}, key)
      ) {
        fail(`Unknown field reference: ${path.join(".")}.`);
        return undefined;
      }
      schema = schema.properties?.[key];
    }
    return schema;
  };
  const assign = (
    actual: AppJsonSchema | undefined,
    expected: AppJsonSchema | undefined,
    label: string,
  ) => {
    if (actual && expected && !appSchemaAccepts(actual, expected))
      fail(`Incompatible ${label} schema.`);
  };
  const expect = (schema: AppJsonSchema | undefined, kinds: string[]) => {
    if (schema && !kinds.includes(schema.type))
      fail(`Expected ${kinds.join("/")}, received ${schema.type}.`);
  };
  const expression = (
    node: AppExpression,
    item?: AppJsonSchema,
    depth = 0,
  ): AppJsonSchema | undefined => {
    if (++nodes > limits.recipeNodes || depth > limits.recipeDepth) {
      fail("Expression structural budget exceeded.");
      return undefined;
    }
    const child = (value: AppExpression, context = item) =>
      expression(value, context, depth + 1);
    switch (node.op) {
      case "literal":
        return inferAppLiteral(node.value, fail);
      case "input":
        if (node.step) fail("Input references cannot select a step.");
        return field(action.inputSchema, node.path);
      case "result":
        if (!node.step || !prior.has(node.step))
          fail("Results must reference an earlier step.");
        return field(node.step ? prior.get(node.step) : undefined, node.path);
      case "item":
        if (!item || node.step)
          fail("Item references require a bounded collection context.");
        return field(item, node.path);
      case "id":
      case "owner":
        return id;
      case "now":
        return { type: "string", maxLength: 24 };
      case "check-number":
        if (node.minimum > node.maximum)
          fail("Numeric minimum must not exceed maximum.");
        expect(child(node.value), ["number", "integer"]);
        return {
          type: node.integer ? "integer" : "number",
          minimum: node.minimum,
          maximum: node.maximum,
        };
      case "has":
        field(child(node.source), node.path);
        return boolean;
      case "length": {
        const value = child(node.value);
        expect(value, ["array", "string"]);
        return {
          type: "integer",
          minimum:
            value?.type === "array"
              ? (value.minItems ?? 0)
              : (value?.minLength ?? 0),
          maximum: value?.type === "array" ? value.maxItems : value?.maxLength,
        };
      }
      case "at": {
        const source = child(node.source);
        expect(source, ["array"]);
        expect(child(node.index), ["integer"]);
        return source?.items;
      }
      case "round":
      case "convert-unit":
        if (
          node.op === "convert-unit" &&
          appUnits[node.from].dimension !== appUnits[node.to].dimension
        )
          fail("Unit conversion requires matching dimensions.");
        expect(child(node.value), ["integer", "number"]);
        return number;
      case "date-key":
        expect(child(node.value), ["string"]);
        expect(child(node.timeZone), ["string"]);
        return { type: "string", minLength: 10, maxLength: 10 };
      case "object":
        return object(
          Object.fromEntries(
            Object.entries(node.fields).flatMap(([key, value]) => {
              const schema = child(value);
              return schema ? [[key, schema]] : [];
            }),
          ),
        );
      case "array": {
        const items = node.items.map((value) => child(value));
        return {
          type: "array",
          items: items.reduce(
            (left, right) => mergeAppSchemas(left, right, fail),
            undefined,
          ),
          minItems: items.length,
          maxItems: items.length,
        };
      }
      case "not":
        expect(child(node.value), ["boolean"]);
        return boolean;
      case "if":
        expect(child(node.condition), ["boolean"]);
        return mergeAppSchemas(child(node.then), child(node.else), fail);
      case "map":
      case "filter":
      case "sum": {
        const source = child(node.source);
        expect(source, ["array"]);
        const value = child(node.value, source?.items);
        if (node.op === "sum") {
          expect(value, ["number", "integer"]);
          return number;
        }
        if (node.op === "filter") expect(value, ["boolean"]);
        return {
          type: "array",
          items: node.op === "filter" ? source?.items : value,
          minItems:
            node.op === "map"
              ? Math.min(source?.minItems ?? 0, node.maxItems)
              : 0,
          maxItems: Math.min(source?.maxItems ?? node.maxItems, node.maxItems),
        };
      }
      default: {
        const left = child(node.left),
          right = child(node.right);
        if (
          node.op === "add" ||
          node.op === "subtract" ||
          node.op === "multiply" ||
          node.op === "divide" ||
          node.op === "less" ||
          node.op === "greater"
        ) {
          expect(left, ["integer", "number"]);
          expect(right, ["integer", "number"]);
          if (node.op === "less" || node.op === "greater") return boolean;
          return inferAppArithmetic(node.op, left, right);
        }
        if (node.op === "and" || node.op === "or") {
          expect(left, ["boolean"]);
          expect(right, ["boolean"]);
          return boolean;
        }
        if (node.op === "concat") {
          expect(left, ["string"]);
          expect(right, ["string"]);
          return string;
        }
        return node.op === "equal"
          ? boolean
          : left?.type === "null"
            ? right
            : mergeAppSchemas(left, right, fail);
      }
    }
  };
  const capability = (name: string) => {
    if (!action.capabilities.includes(name))
      fail(`Missing capability: ${name}.`);
  };
  for (const step of action.recipe.steps) {
    if (prior.has(step.id)) fail(`Duplicate step ID: ${step.id}.`);
    let result: AppJsonSchema | undefined;
    switch (step.op) {
      case "invoke":
      case "batch": {
        const target = manifest.actions.find(
          (action) => action.name === step.action,
        );
        if (!target) fail("Unknown local action.");
        if (action.effect === "read" && target?.effect !== "read")
          fail("A read action cannot invoke a mutating action.");
        if (
          action.effect === "transaction" &&
          target &&
          !["read", "transaction"].includes(target.effect)
        )
          fail("A transaction cannot invoke external or job actions.");
        for (const name of target?.capabilities ?? []) capability(name);
        let item: AppJsonSchema | undefined;
        let source: AppJsonSchema | undefined;
        if (step.op === "batch") {
          source = expression(step.source);
          expect(source, ["array"]);
          item = source?.items;
        }
        assign(
          expression(step.input, item),
          target?.inputSchema,
          "local action input",
        );
        result =
          step.op === "batch"
            ? object({
                results: {
                  type: "array",
                  items: target?.resultSchema,
                  minItems: Math.min(source?.minItems ?? 0, step.maxItems),
                  maxItems: Math.min(
                    source?.maxItems ?? step.maxItems,
                    step.maxItems,
                  ),
                },
              })
            : target?.resultSchema;
        break;
      }
      case "let":
        result = expression(step.value);
        break;
      case "assert":
        expect(expression(step.condition), ["boolean"]);
        result = boolean;
        break;
      case "query":
      case "get":
      case "create":
      case "update":
      case "restore":
      case "delete": {
        const table = manifest.tables.find(
          (table) => table.name === step.table,
        );
        if (!table) fail(`Unknown table: ${step.table}.`);
        const read = step.op === "query" || step.op === "get";
        capability(`data.${step.table}.${read ? "read" : "write"}`);
        if (!read && action.effect === "read")
          fail("A read action cannot mutate data.");
        const row = table
          ? object({
              id,
              revision: { type: "integer" },
              data: table.schema,
            })
          : undefined;
        if (step.op === "query") {
          for (const filter of step.where) {
            field(table?.schema, filter.field);
            expression(filter.value);
          }
          for (const order of step.order) field(table?.schema, order.field);
          if (step.cursor) expect(expression(step.cursor), ["string"]);
          result = object({
            records: { type: "array", items: row, maxItems: step.limit },
          });
          result.required = ["records"];
          result.properties!.nextCursor = string;
        } else {
          expect(expression(step.recordId), ["string"]);
          if (
            step.op === "update" ||
            step.op === "delete" ||
            step.op === "restore"
          )
            expect(expression(step.revision), ["integer", "number"]);
          if (step.op === "create" || step.op === "update") {
            const value = expression(step.value);
            expect(value, ["object"]);
            assign(value, table?.schema, "record");
          }
          result = step.op === "delete" ? object({ id }) : row;
        }
        break;
      }
      case "call":
        capability(`dependency.${step.dependency}.call`);
        if (!manifest.dependencies.some((item) => item.key === step.dependency))
          fail("Unknown dependency call.");
        expression(step.input);
        break;
      case "request": {
        const integration = manifest.integrations.find(
          (item) => item.id === step.integration,
        );
        capability(`integration.${step.integration}.request`);
        if (!integration) fail("Unknown integration.");
        if (action.effect !== "external")
          fail("Network requests require an external action.");
        assign(
          expression(step.input),
          integration?.inputSchema,
          "integration input",
        );
        result = integration?.resultSchema;
        break;
      }
      case "dispatch":
        capability("jobs.dispatch");
        const target = manifest.actions.find(
          (item) => item.name === step.action,
        );
        if (!target) fail("Unknown dispatched action.");
        assign(expression(step.input), target?.inputSchema, "dispatch input");
        if (action.effect === "read")
          fail("A read action cannot dispatch work.");
        result = object({ jobId: id });
        break;
      case "file-export":
        capability("files.export");
        expect(expression(step.name), ["string"]);
        expression(step.value);
        result = object({ fileId: id });
        break;
      case "publish-widget":
        capability("widgets.publish");
        expression(step.value);
        expect(expression(step.fallback), ["string"]);
        if (
          !manifest.ui.some(
            (item) => item.id === step.widget && item.surface === "widget",
          )
        )
          fail("Unknown widget renderer.");
        result = object({ widgetId: id });
        break;
    }
    prior.set(step.id, result);
  }
  assign(expression(action.recipe.result), action.resultSchema, "result");
  return errors;
}

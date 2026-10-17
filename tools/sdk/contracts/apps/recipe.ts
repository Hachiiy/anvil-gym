import { z } from "zod";
import { appPlatformLimits as limits } from "../limits.js";
import { appKeySchema } from "./identity.js";
import { appUnitSchema } from "./units.js";

const fieldPath = z
  .array(
    z
      .string()
      .min(1)
      .max(100)
      .refine(
        (key) => !["__proto__", "prototype", "constructor"].includes(key),
      ),
  )
  .max(limits.schemaDepth);

export const appExpressionSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("literal"), value: z.json() }),
  z.strictObject({
    op: z.enum(["input", "result", "item"]),
    path: fieldPath,
    step: appKeySchema.optional(),
  }),
  z.strictObject({ op: z.enum(["id", "now", "owner"]) }),
  z.strictObject({
    op: z.literal("check-number"),
    get value() {
      return appExpressionSchema;
    },
    minimum: z.number(),
    maximum: z.number(),
    integer: z.boolean(),
  }),
  z.strictObject({
    op: z.literal("has"),
    get source() {
      return appExpressionSchema;
    },
    path: fieldPath,
  }),
  z.strictObject({
    op: z.literal("length"),
    get value() {
      return appExpressionSchema;
    },
  }),
  z.strictObject({
    op: z.literal("at"),
    get source() {
      return appExpressionSchema;
    },
    get index() {
      return appExpressionSchema;
    },
  }),
  z.strictObject({
    op: z.literal("round"),
    get value() {
      return appExpressionSchema;
    },
    digits: z.number().int().min(0).max(limits.decimalDigits),
  }),
  z.strictObject({
    op: z.literal("convert-unit"),
    get value() {
      return appExpressionSchema;
    },
    from: appUnitSchema,
    to: appUnitSchema,
  }),
  z.strictObject({
    op: z.literal("date-key"),
    get value() {
      return appExpressionSchema;
    },
    get timeZone() {
      return appExpressionSchema;
    },
  }),
  z.strictObject({
    op: z.literal("object"),
    get fields() {
      return z.record(z.string().max(100), appExpressionSchema);
    },
  }),
  z.strictObject({
    op: z.literal("array"),
    get items() {
      return z.array(appExpressionSchema).max(limits.schemaArrayItems);
    },
  }),
  z.strictObject({
    op: z.enum([
      "add",
      "subtract",
      "multiply",
      "divide",
      "equal",
      "less",
      "greater",
      "and",
      "or",
      "coalesce",
      "concat",
    ]),
    get left() {
      return appExpressionSchema;
    },
    get right() {
      return appExpressionSchema;
    },
  }),
  z.strictObject({
    op: z.literal("not"),
    get value() {
      return appExpressionSchema;
    },
  }),
  z.strictObject({
    op: z.literal("if"),
    get condition() {
      return appExpressionSchema;
    },
    get then() {
      return appExpressionSchema;
    },
    get else() {
      return appExpressionSchema;
    },
  }),
  z.strictObject({
    op: z.enum(["map", "filter", "sum"]),
    get source() {
      return appExpressionSchema;
    },
    get value() {
      return appExpressionSchema;
    },
    maxItems: z.number().int().positive().max(limits.schemaArrayItems),
  }),
]);
export type AppExpression = z.infer<typeof appExpressionSchema>;

export const appStepSchema = z.discriminatedUnion("op", [
  z.strictObject({
    id: appKeySchema,
    op: z.literal("invoke"),
    action: appKeySchema,
    input: appExpressionSchema,
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("batch"),
    action: appKeySchema,
    source: appExpressionSchema,
    input: appExpressionSchema,
    maxItems: z.number().int().positive().max(limits.mutationRows),
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("let"),
    value: appExpressionSchema,
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("assert"),
    condition: appExpressionSchema,
    message: z.string().min(1).max(200),
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("query"),
    table: appKeySchema,
    where: z
      .array(
        z.strictObject({
          field: fieldPath,
          compare: z.enum(["eq", "lt", "gt", "in"]),
          value: appExpressionSchema,
        }),
      )
      .max(16),
    order: z
      .array(
        z.strictObject({
          field: fieldPath,
          direction: z.enum(["asc", "desc"]),
        }),
      )
      .max(4),
    limit: z.number().int().positive().max(limits.queryRows),
    cursor: appExpressionSchema.optional(),
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("get"),
    table: appKeySchema,
    recordId: appExpressionSchema,
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("create"),
    table: appKeySchema,
    recordId: appExpressionSchema,
    value: appExpressionSchema,
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("update"),
    table: appKeySchema,
    recordId: appExpressionSchema,
    revision: appExpressionSchema,
    value: appExpressionSchema,
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("delete"),
    table: appKeySchema,
    recordId: appExpressionSchema,
    revision: appExpressionSchema,
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("call"),
    dependency: appKeySchema,
    action: appKeySchema,
    input: appExpressionSchema,
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("request"),
    integration: appKeySchema,
    input: appExpressionSchema,
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("dispatch"),
    action: appKeySchema,
    input: appExpressionSchema,
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("file-export"),
    name: appExpressionSchema,
    value: appExpressionSchema,
  }),
  z.strictObject({
    id: appKeySchema,
    op: z.literal("publish-widget"),
    widget: appKeySchema,
    mode: z.enum(["snapshot", "live"]),
    value: appExpressionSchema,
    fallback: appExpressionSchema,
  }),
]);
export const appRecipeSchema = z.strictObject({
  version: z.literal(1),
  steps: z.array(appStepSchema).max(limits.recipeNodes),
  result: appExpressionSchema,
});
export type AppStep = z.infer<typeof appStepSchema>;
export type AppRecipe = z.infer<typeof appRecipeSchema>;

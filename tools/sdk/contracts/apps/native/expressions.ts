import { z } from "zod";
import { appPlatformLimits } from "../../limits.js";
import { appFieldKeySchema, appKeySchema } from "../identity.js";

const limits = appPlatformLimits.nativeUi;
export const nativeFieldPathSchema = z
  .array(
    z.union([
      appFieldKeySchema,
      z
        .number()
        .int()
        .nonnegative()
        .max(limits.listItems - 1),
      z.strictObject({ itemIndex: appKeySchema }),
    ]),
  )
  .max(appPlatformLimits.schemaDepth);

export const nativeExpressionSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("literal"), value: z.json() }),
  z.strictObject({
    op: z.literal("ref"),
    scope: z.enum([
      "params",
      "state",
      "form",
      "source",
      "source-status",
      "item",
      "event",
      "host",
    ]),
    name: appKeySchema.optional(),
    path: nativeFieldPathSchema,
  }),
  z.strictObject({
    op: z.literal("object"),
    get fields() {
      return z.record(appFieldKeySchema, nativeExpressionSchema);
    },
  }),
  z.strictObject({
    op: z.literal("array"),
    get items() {
      return z.array(nativeExpressionSchema).max(limits.listItems);
    },
  }),
  z.strictObject({
    op: z.enum([
      "equal",
      "less",
      "greater",
      "add",
      "subtract",
      "multiply",
      "divide",
      "and",
      "or",
      "coalesce",
      "concat",
    ]),
    get left() {
      return nativeExpressionSchema;
    },
    get right() {
      return nativeExpressionSchema;
    },
  }),
  z.strictObject({
    op: z.enum(["not", "present", "length"]),
    get value() {
      return nativeExpressionSchema;
    },
  }),
  z.strictObject({
    op: z.literal("if"),
    get condition() {
      return nativeExpressionSchema;
    },
    get then() {
      return nativeExpressionSchema;
    },
    get else() {
      return nativeExpressionSchema;
    },
  }),
  z.strictObject({
    op: z.enum(["map", "filter"]),
    get source() {
      return nativeExpressionSchema;
    },
    as: appKeySchema,
    get value() {
      return nativeExpressionSchema;
    },
    maxItems: z.number().int().positive().max(limits.listItems),
  }),
  z.strictObject({
    op: z.literal("append"),
    get source() {
      return nativeExpressionSchema;
    },
    get value() {
      return nativeExpressionSchema;
    },
    maxItems: z.number().int().positive().max(limits.listItems),
  }),
  z.strictObject({
    op: z.literal("remove-at"),
    get source() {
      return nativeExpressionSchema;
    },
    get index() {
      return nativeExpressionSchema;
    },
    maxItems: z.number().int().positive().max(limits.listItems),
  }),
  z.strictObject({
    op: z.literal("format"),
    format: z.enum(["number", "date", "time"]),
    get value() {
      return nativeExpressionSchema;
    },
    digits: z
      .number()
      .int()
      .min(0)
      .max(appPlatformLimits.decimalDigits)
      .optional(),
  }),
]);
export type NativeExpression = z.infer<typeof nativeExpressionSchema>;
export type NativeFieldPath = z.infer<typeof nativeFieldPathSchema>;

export const nativeTextSchema = z.union([
  z.string().max(4000),
  nativeExpressionSchema,
]);
export const nativeLabelSchema = z.union([
  z.string().min(1).max(200),
  nativeExpressionSchema,
]);
export const nativeBooleanSchema = z.union([
  z.boolean(),
  nativeExpressionSchema,
]);

export function nativeExpressionChildren(
  node: NativeExpression,
): NativeExpression[] {
  switch (node.op) {
    case "literal":
    case "ref":
      return [];
    case "object":
      return Object.values(node.fields);
    case "array":
      return node.items;
    case "not":
    case "present":
    case "length":
    case "format":
      return [node.value];
    case "if":
      return [node.condition, node.then, node.else];
    case "map":
    case "filter":
    case "append":
      return [node.source, node.value];
    case "remove-at":
      return [node.source, node.index];
    default:
      return [node.left, node.right];
  }
}

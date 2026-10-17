import { z } from "zod";
import { appPlatformLimits as limits } from "../limits.js";

// A closed, bounded subset of JSON Schema 2020-12. Unsupported keywords fail.
const appJsonSchemaShape = z
  .strictObject({
    type: z.enum([
      "object",
      "array",
      "string",
      "number",
      "integer",
      "boolean",
      "null",
    ]),
    description: z.string().max(1000).optional(),
    get properties() {
      return z.record(z.string().max(100), appJsonSchemaShape).optional();
    },
    required: z
      .array(z.string().max(100))
      .max(limits.schemaProperties)
      .optional(),
    additionalProperties: z.literal(false).optional(),
    get items() {
      return appJsonSchemaShape.optional();
    },
    maxItems: z.number().int().min(0).max(limits.schemaArrayItems).optional(),
    minItems: z.number().int().min(0).max(limits.schemaArrayItems).optional(),
    maxLength: z.number().int().min(0).max(limits.inputBytes).optional(),
    minLength: z.number().int().min(0).max(limits.inputBytes).optional(),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
    enum: z
      .array(
        z.union([
          z.string().max(1000),
          z.number().finite(),
          z.boolean(),
          z.null(),
        ]),
      )
      .min(1)
      .max(100)
      .optional(),
  })
  .superRefine((schema, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: "custom", message });
    const allowed = new Set(["type", "description", "enum"]);
    if (schema.type === "object") {
      ["properties", "required", "additionalProperties"].forEach((key) =>
        allowed.add(key),
      );
      if (!schema.properties || schema.additionalProperties !== false)
        issue("Objects require properties and additionalProperties: false.");
      if (Object.keys(schema.properties ?? {}).length > limits.schemaProperties)
        issue("Too many schema properties.");
      if (
        new Set(schema.required).size !== (schema.required?.length ?? 0) ||
        schema.required?.some(
          (key) => !Object.hasOwn(schema.properties ?? {}, key),
        )
      )
        issue("Required fields must name unique declared properties.");
    } else if (schema.type === "array") {
      ["items", "maxItems", "minItems"].forEach((key) => allowed.add(key));
      if (!schema.items || schema.maxItems === undefined)
        issue("Arrays require bounded items.");
      if ((schema.minItems ?? 0) > (schema.maxItems ?? 0))
        issue("Invalid array bounds.");
    } else if (schema.type === "string") {
      ["minLength", "maxLength"].forEach((key) => allowed.add(key));
      if (schema.maxLength === undefined) issue("Strings require maxLength.");
      if ((schema.minLength ?? 0) > (schema.maxLength ?? 0))
        issue("Invalid string bounds.");
    } else if (schema.type === "number" || schema.type === "integer") {
      ["minimum", "maximum"].forEach((key) => allowed.add(key));
      if (
        schema.minimum !== undefined &&
        schema.maximum !== undefined &&
        schema.minimum > schema.maximum
      )
        issue("Invalid numeric bounds.");
    }
    if (Object.keys(schema).some((key) => !allowed.has(key)))
      issue("Keyword does not apply to this type.");
  });
export const appJsonSchema = z
  .unknown()
  .superRefine((value, context) => {
    const pending = [{ value, depth: 0, leave: false }];
    const seen = new Set<object>();
    let nodes = 0;
    while (pending.length) {
      const item = pending.pop()!;
      if (item.leave) {
        if (item.value && typeof item.value === "object")
          seen.delete(item.value);
        continue;
      }
      if (++nodes > limits.schemaNodes || item.depth > limits.schemaDepth) {
        context.addIssue({
          code: "custom",
          message: "App schema exceeds its structural budget.",
        });
        return;
      }
      if (
        !item.value ||
        typeof item.value !== "object" ||
        Array.isArray(item.value)
      )
        continue;
      if (seen.has(item.value)) {
        context.addIssue({ code: "custom", message: "Cyclic schema." });
        return;
      }
      seen.add(item.value);
      pending.push({ ...item, leave: true });
      if ("items" in item.value && item.value.items)
        pending.push({
          value: item.value.items,
          depth: item.depth + 1,
          leave: false,
        });
      if (
        "properties" in item.value &&
        item.value.properties &&
        typeof item.value.properties === "object"
      ) {
        for (const [key, child] of Object.entries(item.value.properties)) {
          if (["__proto__", "prototype", "constructor"].includes(key)) {
            context.addIssue({
              code: "custom",
              message: "Unsafe schema property.",
            });
            return;
          }
          pending.push({ value: child, depth: item.depth + 1, leave: false });
        }
      }
    }
  })
  .pipe(appJsonSchemaShape);
export type AppJsonSchema = z.infer<typeof appJsonSchema>;

export function validateAppValue(
  schema: AppJsonSchema,
  value: unknown,
  path = "$",
): string[] {
  const errors: string[] = [];
  const fail = () =>
    errors.push(`${path}: value does not match the declared schema.`);
  if (schema.enum && !schema.enum.some((item) => item === value)) fail();
  switch (schema.type) {
    case "null":
      if (value !== null) fail();
      break;
    case "boolean":
      if (typeof value !== "boolean") fail();
      break;
    case "number":
    case "integer":
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        (schema.type === "integer" && !Number.isSafeInteger(value)) ||
        (schema.minimum !== undefined && value < schema.minimum) ||
        (schema.maximum !== undefined && value > schema.maximum)
      )
        fail();
      break;
    case "string":
      if (
        typeof value !== "string" ||
        value.length < (schema.minLength ?? 0) ||
        value.length > (schema.maxLength ?? 0)
      )
        fail();
      break;
    case "array":
      if (
        !Array.isArray(value) ||
        value.length < (schema.minItems ?? 0) ||
        value.length > (schema.maxItems ?? 0)
      )
        fail();
      else if (schema.items)
        value.forEach((item, index) =>
          errors.push(
            ...validateAppValue(schema.items!, item, `${path}[${index}]`),
          ),
        );
      break;
    case "object":
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        fail();
        break;
      }
      for (const key of schema.required ?? [])
        if (!Object.hasOwn(value, key))
          errors.push(`${path}.${key}: required.`);
      for (const [key, item] of Object.entries(value)) {
        const field =
          schema.properties && Object.hasOwn(schema.properties, key)
            ? schema.properties[key]
            : undefined;
        if (!field) errors.push(`${path}.${key}: unknown field.`);
        else errors.push(...validateAppValue(field, item, `${path}.${key}`));
      }
  }
  return errors;
}

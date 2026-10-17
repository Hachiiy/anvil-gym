import type { AppJsonSchema } from "./json-schema.js";
import { validateAppValue } from "./json-schema.js";

export function inferAppArithmetic(
  operation: "add" | "subtract" | "multiply" | "divide",
  left: AppJsonSchema | undefined,
  right: AppJsonSchema | undefined,
): AppJsonSchema {
  const schema: AppJsonSchema = {
    type:
      operation !== "divide" &&
      left?.type === "integer" &&
      right?.type === "integer"
        ? "integer"
        : "number",
  };
  // Addition and subtraction are monotonic. Preserve only bounds justified by
  // both operands; never manufacture a finite bound for an unbounded input.
  if (operation === "add" || operation === "subtract") {
    const pairs =
      operation === "add"
        ? ([
            ["minimum", left?.minimum, right?.minimum],
            ["maximum", left?.maximum, right?.maximum],
          ] as const)
        : ([
            ["minimum", left?.minimum, right?.maximum],
            ["maximum", left?.maximum, right?.minimum],
          ] as const);
    for (const [key, a, b] of pairs) {
      if (a === undefined || b === undefined) continue;
      const value = operation === "add" ? a + b : a - b;
      if (Number.isFinite(value)) schema[key] = value;
    }
  }
  return schema;
}

export function appSchemaAccepts(
  value: AppJsonSchema,
  target: AppJsonSchema,
): boolean {
  if (
    value.type !== target.type &&
    !(value.type === "integer" && target.type === "number")
  )
    return false;
  if (value.enum?.some((literal) => validateAppValue(target, literal).length))
    return false;
  if (
    target.enum &&
    (!value.enum ||
      value.enum.some((literal) => !target.enum!.includes(literal)))
  )
    return false;
  if (target.type === "object") {
    if (
      (target.required ?? []).some(
        (key) =>
          !value.properties?.[key] || !(value.required ?? []).includes(key),
      )
    )
      return false;
    return Object.entries(value.properties ?? {}).every(
      ([key, field]) =>
        !!target.properties?.[key] &&
        appSchemaAccepts(field, target.properties[key]!),
    );
  }
  if (
    target.type === "array" &&
    value.items &&
    target.items &&
    !appSchemaAccepts(value.items, target.items)
  )
    return false;
  for (const [lower, upper] of [
    ["minimum", "maximum"],
    ["minLength", "maxLength"],
    ["minItems", "maxItems"],
  ] as const) {
    const effectiveLower =
      value[lower] ?? (lower === "minimum" ? undefined : 0);
    if (
      target[lower] !== undefined &&
      (effectiveLower === undefined || effectiveLower < target[lower]!)
    )
      return false;
    if (
      target[upper] !== undefined &&
      (value[upper] === undefined || value[upper]! > target[upper]!)
    )
      return false;
  }
  return true;
}

export function mergeAppSchemas(
  left: AppJsonSchema | undefined,
  right: AppJsonSchema | undefined,
  fail: (message: string) => void,
): AppJsonSchema | undefined {
  if (!left) return right;
  if (!right) return left;
  const numeric =
    ["integer", "number"].includes(left.type) &&
    ["integer", "number"].includes(right.type);
  if (left.type !== right.type && !numeric) {
    fail("Incompatible expression branches or collection members.");
    return undefined;
  }
  if (left.type === "object") {
    const properties: Record<string, AppJsonSchema> = {};
    for (const key of new Set([
      ...Object.keys(left.properties ?? {}),
      ...Object.keys(right.properties ?? {}),
    ])) {
      const merged = mergeAppSchemas(
        left.properties?.[key],
        right.properties?.[key],
        fail,
      );
      if (merged) properties[key] = merged;
    }
    return {
      type: "object",
      properties,
      required: (left.required ?? []).filter((key) =>
        right.required?.includes(key),
      ),
      additionalProperties: false,
    };
  }
  if (left.type === "array")
    return {
      type: "array",
      items: mergeAppSchemas(left.items, right.items, fail),
      minItems: Math.min(left.minItems ?? 0, right.minItems ?? 0),
      maxItems: Math.max(left.maxItems ?? 0, right.maxItems ?? 0),
    };
  const result: AppJsonSchema = {
    type: left.type === right.type ? left.type : "number",
  };
  if (left.enum && right.enum && left.enum.length + right.enum.length <= 100)
    result.enum = [...new Set([...left.enum, ...right.enum])];
  for (const [lower, upper] of [
    ["minimum", "maximum"],
    ["minLength", "maxLength"],
  ] as const) {
    if (left[lower] !== undefined && right[lower] !== undefined)
      result[lower] = Math.min(left[lower]!, right[lower]!);
    if (left[upper] !== undefined && right[upper] !== undefined)
      result[upper] = Math.max(left[upper]!, right[upper]!);
  }
  return result;
}

export function inferAppLiteral(
  value: unknown,
  fail: (message: string) => void,
): AppJsonSchema | undefined {
  if (value === null) return { type: "null", enum: [null] };
  if (typeof value === "number")
    return {
      type: Number.isInteger(value) ? "integer" : "number",
      enum: [value],
      minimum: value,
      maximum: value,
    };
  if (typeof value === "string")
    return {
      type: "string",
      enum: [value],
      minLength: value.length,
      maxLength: value.length,
    };
  if (typeof value === "boolean") return { type: "boolean", enum: [value] };
  if (Array.isArray(value))
    return {
      type: "array",
      items: value
        .map((item) => inferAppLiteral(item, fail))
        .reduce((left, right) => mergeAppSchemas(left, right, fail), undefined),
      minItems: value.length,
      maxItems: value.length,
    };
  if (value && typeof value === "object") {
    const properties = Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) => {
        const schema = inferAppLiteral(entry, fail);
        return schema ? [[key, schema]] : [];
      }),
    );
    return {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    };
  }
  return undefined;
}

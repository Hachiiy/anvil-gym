import type { AppJsonSchema } from "../json-schema.js";

export function nativeDraftSchema(schema: AppJsonSchema): AppJsonSchema {
  if (schema.type === "object")
    return {
      ...schema,
      required: [],
      properties: Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([name, field]) => [
          name,
          nativeDraftSchema(field),
        ]),
      ),
    };
  if (schema.type === "array")
    return {
      ...schema,
      minItems: 0,
      items: schema.items && nativeDraftSchema(schema.items),
    };
  return schema;
}

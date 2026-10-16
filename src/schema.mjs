// The bounded JSON Schema subset supported by the App data contract.
export const text = (maxLength, minLength = 0) => ({
  type: "string",
  minLength,
  maxLength,
});
export const choice = (...values) => ({ ...text(100), enum: values });
export const integer = (minimum, maximum) => ({
  type: "integer",
  minimum,
  maximum,
});
export const numeric = (minimum, maximum) => ({
  type: "number",
  minimum,
  maximum,
});
export const flag = { type: "boolean" };
export const list = (items, maxItems, minItems = 0) => ({
  type: "array",
  items,
  minItems,
  maxItems,
});
export const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
export const reference = text(36, 36);

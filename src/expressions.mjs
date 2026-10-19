/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const literal = (value) => ({ op: "literal", value });
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const input = (...path) => ({ op: "input", path });
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const item = (...path) => ({ op: "item", path });
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const result = (step, ...path) => ({ op: "result", step, path });
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const fields = (values) => ({ op: "object", fields: values });
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const binary = (op, left, right) => ({ op, left, right });
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const equal = (left, right) => binary("equal", left, right);
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const not = (value) => ({ op: "not", value });
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const length = (value) => ({ op: "length", value });
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const all = (...values) =>
  values.reduce((left, right) => binary("and", left, right), literal(true));
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const any = (...values) =>
  values.reduce((left, right) => binary("or", left, right), literal(false));
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const oneOf = (value, options) =>
  any(...options.map((option) => equal(value, literal(option))));
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const filtered = (source, value, maxItems = 12) => ({
  op: "filter",
  source,
  value,
  maxItems,
});
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const mapped = (source, value, maxItems = 12) => ({
  op: "map",
  source,
  value,
  maxItems,
});
/** @returns {import("@anvil/app-sdk/author").AppExpression} */
export const conditional = (condition, yes, no) => ({
  op: "if",
  condition,
  then: yes,
  else: no,
});
export const invoke = (id, action, value) => ({
  id,
  op: "invoke",
  action,
  input: value,
});
export const batch = (id, action, source, value, maxItems = 12) => ({
  id,
  op: "batch",
  action,
  source,
  input: value,
  maxItems,
});
export const assertion = (id, condition, message) => ({
  id,
  op: "assert",
  condition,
  message,
});
/** @returns {import("@anvil/app-sdk/author").AppAction} */
export const readAction = (
  name,
  summary,
  inputSchema,
  steps,
  resultSchema,
  value,
) => ({
  name,
  summary,
  inputSchema,
  resultSchema,
  effect: "read",
  capabilities: [],
  recipe: { version: 1, steps, result: value },
});

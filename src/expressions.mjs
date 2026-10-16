export const literal = (value) => ({ op: "literal", value });
export const input = (...path) => ({ op: "input", path });
export const item = (...path) => ({ op: "item", path });
export const result = (step, ...path) => ({ op: "result", step, path });
export const fields = (values) => ({ op: "object", fields: values });
export const binary = (op, left, right) => ({ op, left, right });
export const equal = (left, right) => binary("equal", left, right);
export const not = (value) => ({ op: "not", value });
export const length = (value) => ({ op: "length", value });
export const all = (...values) =>
  values.reduce((left, right) => binary("and", left, right), literal(true));
export const any = (...values) =>
  values.reduce((left, right) => binary("or", left, right), literal(false));
export const oneOf = (value, options) =>
  any(...options.map((option) => equal(value, literal(option))));
export const filtered = (source, value, maxItems = 12) => ({
  op: "filter",
  source,
  value,
  maxItems,
});
export const mapped = (source, value, maxItems = 12) => ({
  op: "map",
  source,
  value,
  maxItems,
});
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

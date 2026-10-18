import { literal, type Binding } from "./helpers.js";

export const countLabel = (
  value: Binding,
  single: string,
  plural = `${single}s`,
): Binding => ({
  op: "concat",
  left: { op: "format", format: "number", value, digits: 0 },
  right: {
    op: "if",
    condition: { op: "equal", left: value, right: literal(1) },
    then: literal(` ${single}`),
    else: literal(` ${plural}`),
  },
});
export const kindLabel = (kind: Binding): Binding => ({
  op: "if",
  condition: { op: "equal", left: kind, right: literal("single") },
  then: literal("Single"),
  else: {
    op: "if",
    condition: { op: "equal", left: kind, right: literal("superset") },
    then: literal("Superset"),
    else: literal("Circuit"),
  },
});
export const groupLabel = (kind: Binding, position: Binding): Binding => ({
  op: "concat",
  left: { op: "concat", left: kindLabel(kind), right: literal(" ") },
  right: {
    op: "format",
    format: "number",
    digits: 0,
    value: { op: "add", left: position, right: literal(1) },
  },
});
export const join = (
  left: Binding,
  right: Binding,
  separator = " · ",
): Binding => ({
  op: "concat",
  left: { op: "concat", left, right: literal(separator) },
  right,
});

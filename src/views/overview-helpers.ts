import type { NativeEvent, NativeNode } from "@anvil/app-sdk/author";
import { button, literal, ref, type Binding } from "./helpers.js";

export const cardCount = 6;
export const cardName = (slot: number) => `logging-${slot}`;
export const compareName = (slot: number) => `previous-${slot}`;
export const loggingValue = (
  slot: number,
  ...path: (string | number | { itemIndex: string })[]
) => ref("source", ["cards", slot, ...path], "screen");
export const safe = (left: Binding, right: Binding): Binding => ({
  op: "coalesce",
  left,
  right,
});
export const submitCards: NativeEvent[] = Array.from(
  { length: cardCount },
  (_, slot) => ({
    op: "submit-form",
    form: cardName(slot),
    onSuccess: [],
    onFailure: [],
  }),
);
export const copyBlocked = (slot: number): Binding => ({
  op: "or",
  left: safe(
    ref("form", ["sets", { itemIndex: "set" }, "completed"], cardName(slot)),
    literal(false),
  ),
  right: {
    op: "greater",
    right: literal(0),
    left: {
      op: "length",
      value: {
        op: "filter",
        source: safe(
          ref("form", ["sets", { itemIndex: "set" }, "values"], cardName(slot)),
          literal([]),
        ),
        as: "recorded",
        maxItems: 12,
        value: { op: "present", value: ref("item", ["value"], "recorded") },
      },
    },
  },
});
export function copyButton(slot: number, previous = false): NativeNode {
  const values = previous
    ? ref("item", ["values"], "comparison")
    : safe(
        loggingValue(slot, "sets", { itemIndex: "set" }, "planned"),
        literal([]),
      );
  return button(
    `copy-${previous ? "previous" : "plan"}-${slot}`,
    previous ? "Use previous" : "Use plan",
    [
      {
        op: "set-form",
        form: cardName(slot),
        path: ["sets", { itemIndex: "set" }, "values"],
        value: values,
      },
    ],
    "ghost",
    previous
      ? {
          op: "or",
          left: copyBlocked(slot),
          right: { op: "not", value: ref("item", ["available"], "comparison") },
        }
      : copyBlocked(slot),
  );
}

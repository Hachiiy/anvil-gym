import type {
  NativeEvent,
  NativeNode,
  NativeViewDefinition,
} from "@anvil/app-sdk/author";
import { button, literal, object, ref, text, type Binding } from "./helpers.js";

type Success = Extract<NativeEvent, { op: "invoke" }>["onSuccess"];
export const recoveryActions = [
  "undo-workout-removal",
  "dismiss-workout-removal",
];
export function removalConfirmation(
  id: string,
  label: string,
  action: string,
  input: Binding,
  description: Binding,
  onSuccess: Success,
): NonNullable<NativeViewDefinition["dialogs"]>[number] {
  return {
    id,
    label,
    root: {
      id: `${id}-confirmation`,
      component: "stack",
      props: { gap: "normal" },
      children: [
        text(`${id}-target`, description),
        button(`${id}-confirm`, "Remove", [
          {
            op: "invoke",
            action,
            input,
            onSuccess: [{ op: "close-dialog", dialog: id }, ...onSuccess],
            onFailure: [],
          },
        ]),
      ],
    },
  };
}
export const removalTarget = (): Binding => ({
  op: "if",
  condition: {
    op: "greater",
    left: ref("item", ["data", "ordinal"], "removal"),
    right: literal(0),
  },
  then: {
    op: "concat",
    left: {
      op: "concat",
      left: {
        op: "format",
        format: "number",
        digits: 0,
        value: ref("item", ["data", "ordinal"], "removal"),
      },
      right: literal(". "),
    },
    right: ref("item", ["data", "label"], "removal"),
  },
  else: ref("item", ["data", "label"], "removal"),
});
export function recoveryControls(id: string, onSuccess: Success): NativeNode {
  const identity = object({
    id: ref("item", ["id"], "removal"),
    revision: ref("item", ["revision"], "removal"),
  });
  return {
    id,
    component: "list",
    props: {
      items: ref("source", ["records"], "removals"),
      as: "removal",
      key: ["id"],
      maxItems: 1,
    },
    template: {
      id: `${id}-context`,
      component: "stack",
      props: { gap: "small" },
      children: [
        text(`${id}-target`, removalTarget()),
        {
          id: `${id}-controls`,
          component: "row",
          props: { gap: "small" },
          children: [
            button(
              `${id}-undo`,
              "Undo removal",
              [
                {
                  op: "invoke",
                  action: "undo-workout-removal",
                  input: identity,
                  onSuccess,
                  onFailure: [],
                },
              ],
              "ghost",
            ),
            button(
              `${id}-dismiss`,
              "Dismiss",
              [
                {
                  op: "invoke",
                  action: "dismiss-workout-removal",
                  input: identity,
                  onSuccess: [{ op: "refresh-source", source: "removals" }],
                  onFailure: [],
                },
              ],
              "ghost",
            ),
          ],
        },
      ],
    },
  };
}

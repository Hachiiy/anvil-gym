import type { NativeEvent, NativeNode } from "@anvil/app-sdk/author";
import { button, literal, object, ref, type Binding } from "./helpers.js";

type Success = Extract<NativeEvent, { op: "invoke" }>["onSuccess"];
export const arrangementRecoveryActions = [
  "latest-workout-arrangement",
  "undo-workout-arrangement",
  "dismiss-workout-arrangement",
];
export function arrangementUndo(
  refresh: Success,
  before: NativeEvent[] = [],
): NativeNode {
  const identity = object({
    id: ref("item", ["id"], "arrangement"),
    revision: ref("item", ["revision"], "arrangement"),
  });
  return {
    id: "arrangement-undo",
    component: "list",
    props: {
      items: ref("source", ["records"], "arrangements"),
      as: "arrangement",
      key: ["id"],
      maxItems: 1,
    },
    template: {
      id: "arrangement-undo-controls",
      component: "row",
      props: { gap: "small" },
      children: [
        button(
          "undo-arrangement",
          "Undo",
          [
            ...before,
            {
              op: "invoke",
              action: "undo-workout-arrangement",
              input: identity,
              onSuccess: refresh,
              onFailure: [],
            },
          ],
          "ghost",
        ),
        button(
          "dismiss-arrangement",
          "Dismiss",
          [
            {
              op: "invoke",
              action: "dismiss-workout-arrangement",
              input: identity,
              onSuccess: [{ op: "refresh-source", source: "arrangements" }],
              onFailure: [],
            },
          ],
          "ghost",
        ),
      ],
    },
  };
}
export function orderControls(
  id: string,
  source: "structure" | "group",
  currentId: Binding,
  exercise = false,
): NativeNode {
  const live = (key: string): Binding =>
    exercise
      ? {
          op: "coalesce",
          left: ref("source", ["order", { itemIndex: "member" }, key], source),
          right: ref("item", [key], "order"),
        }
      : ref("item", [key], "order");
  return {
    id,
    component: "list",
    props: {
      items: {
        op: "filter",
        source: ref("source", ["order"], source),
        as: "candidate-order",
        maxItems: 50,
        value: {
          op: "equal",
          left: ref("item", ["current", "id"], "candidate-order"),
          right: currentId,
        },
      },
      as: "order",
      key: ["current", "id"],
      maxItems: 1,
    },
    template: {
      id: `${id}-buttons`,
      component: "row",
      props: { gap: "small" },
      children: ["up", "down"].map((direction) => ({
        ...button(
          `${id}-${direction}`,
          direction === "up" ? "Move up" : "Move down",
          [
            ...(exercise
              ? [
                  {
                    op: "submit-form" as const,
                    form: "group",
                    onSuccess: [],
                    onFailure: [],
                  },
                ]
              : []),
            {
              op: "invoke",
              action: exercise
                ? "swap-workout-exercises"
                : "swap-workout-groups",
              input: object({
                sessionId: ref("source", ["session", "id"], source),
                revision: ref("source", ["session", "revision"], source),
                first: live("current"),
                second: live(direction === "up" ? "previous" : "next"),
              }),
              onSuccess: [
                { op: "refresh-source", source },
                { op: "refresh-source", source: "arrangements" },
              ],
              onFailure: [],
            },
          ],
        ),
        visible:
          direction === "up"
            ? {
                op: "greater",
                left: ref("item", ["ordinal"], "order"),
                right: literal(1),
              }
            : {
                op: "less",
                left: ref("item", ["ordinal"], "order"),
                right: ref("item", ["total"], "order"),
              },
      })),
    },
  };
}

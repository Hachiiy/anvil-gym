import type { NativeNode } from "@anvil/app-sdk/author";
import { button, literal, object, ref, type Binding } from "./helpers.js";
import { routineBlocks } from "./routine-blocks.js";

export function exercisePicker(mode: "routine" | "block"): NativeNode {
  const value: Binding =
    mode === "routine"
      ? {
          op: "append",
          source: routineBlocks,
          value: ref("event"),
          maxItems: 30,
        }
      : {
          op: "append",
          source: {
            op: "coalesce",
            left: ref("form", ["value", "occurrences"], "routine"),
            right: literal([]),
          },
          value: ref("event", ["occurrences", 0]),
          maxItems: 12,
        };
  return {
    id: "routine-exercise-picker",
    component: "stack",
    props: { gap: "small" },
    children: [
      {
        id: "routine-library-choices",
        component: "list",
        props: {
          items: ref("source", ["records"], "exercises"),
          as: "exercise",
          key: ["id"],
          maxItems: 50,
        },
        template: {
          id: "routine-library-choice",
          component: "card",
          props: { gap: "small" },
          children: [
            {
              id: "routine-choice-name",
              component: "heading",
              props: {
                text: ref("item", ["data", "name"], "exercise"),
                level: 3,
              },
            },
            button("choose-routine-exercise", "Add exercise", [
              {
                op: "invoke",
                action: "prepare-routine-block",
                input: object({ exerciseId: ref("item", ["id"], "exercise") }),
                onSuccess: [
                  {
                    op: "set-form",
                    form: "routine",
                    path:
                      mode === "routine"
                        ? ["value", "blocks"]
                        : ["value", "occurrences"],
                    value,
                  },
                  { op: "close-dialog", dialog: "exercise-picker" },
                ],
                onFailure: [],
              },
            ]),
          ],
        },
      },
      button(
        "close-routine-picker",
        "Cancel",
        [{ op: "close-dialog", dialog: "exercise-picker" }],
        "ghost",
      ),
    ],
  };
}

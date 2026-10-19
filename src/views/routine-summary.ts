import type { NativeNode } from "@anvil/app-sdk/author";
import {
  button,
  literal,
  navigate,
  object,
  ref,
  type Binding,
} from "./helpers.js";
import { routineBlocks } from "./routine-blocks.js";
import { countLabel, join, kindLabel } from "./structure-labels.js";

const safe = (value: Binding, fallback: string): Binding => ({
  op: "coalesce",
  left: value,
  right: literal(fallback),
});
export const blocksSummary: NativeNode = {
  id: "routine-block-summary",
  component: "list",
  props: {
    items: {
      op: "map",
      source: routineBlocks,
      as: "candidate",
      maxItems: 30,
      value: object({
        key: safe(
          ref("item", ["key"], "candidate"),
          "00000000-0000-0000-0000-000000000000",
        ),
        kind: safe(ref("item", ["kind"], "candidate"), "single"),
        rounds: {
          op: "coalesce",
          left: ref("item", ["rounds"], "candidate"),
          right: literal(1),
        },
        occurrences: {
          op: "coalesce",
          left: ref("item", ["occurrences"], "candidate"),
          right: literal([]),
        },
      }),
    },
    as: "block",
    key: ["key"],
    maxItems: 30,
  },
  template: {
    id: "routine-block-card",
    component: "card",
    props: { gap: "small" },
    children: [
      {
        id: "routine-block-name",
        component: "heading",
        visible: {
          op: "not",
          value: {
            op: "equal",
            left: ref("item", ["kind"], "block"),
            right: literal("single"),
          },
        },
        props: {
          text: join(
            kindLabel(ref("item", ["kind"], "block")),
            countLabel(ref("item", ["rounds"], "block"), "round"),
          ),
          level: 2,
        },
      },
      {
        id: "routine-block-exercises",
        component: "list",
        props: {
          items: {
            op: "filter",
            source: literal(
              Array.from({ length: 12 }, (_, i) => ({ index: i })),
            ),
            as: "candidate-slot",
            maxItems: 12,
            value: {
              op: "less",
              left: ref("item", ["index"], "candidate-slot"),
              right: {
                op: "length",
                value: ref("item", ["occurrences"], "block"),
              },
            },
          },
          as: "slot",
          key: ["index"],
          maxItems: 12,
        },
        template: {
          id: "routine-block-exercise",
          component: "text",
          props: {
            text: join(
              join(
                {
                  op: "format",
                  format: "number",
                  digits: 0,
                  value: {
                    op: "add",
                    left: ref("item", ["index"], "slot"),
                    right: literal(1),
                  },
                },
                safe(
                  ref(
                    "item",
                    ["occurrences", { itemIndex: "slot" }, "snapshot", "name"],
                    "block",
                  ),
                  "Exercise",
                ),
                ". ",
              ),
              {
                op: "concat",
                left: countLabel(
                  {
                    op: "length",
                    value: {
                      op: "coalesce",
                      left: ref(
                        "item",
                        ["occurrences", { itemIndex: "slot" }, "sets"],
                        "block",
                      ),
                      right: literal([]),
                    },
                  },
                  "set",
                ),
                right: {
                  op: "if",
                  condition: {
                    op: "equal",
                    left: ref("item", ["kind"], "block"),
                    right: literal("single"),
                  },
                  then: literal(""),
                  else: literal(" / round"),
                },
              },
            ),
          },
        },
      },
      button("edit-routine-block", "Edit", [
        { op: "submit-form", form: "routine", onSuccess: [], onFailure: [] },
        ...navigate(
          "routine-block",
          object({
            id: ref("params", ["id"]),
            blockKey: ref("item", ["key"], "block"),
          }),
        ),
      ]),
      button(
        "remove-routine-block",
        "Remove",
        [
          {
            op: "set-form",
            form: "routine",
            path: ["value", "blocks"],
            value: {
              op: "filter",
              source: routineBlocks,
              as: "candidate",
              maxItems: 30,
              value: {
                op: "not",
                value: {
                  op: "equal",
                  left: safe(ref("item", ["key"], "candidate"), ""),
                  right: ref("item", ["key"], "block"),
                },
              },
            },
          },
        ],
        "ghost",
      ),
    ],
  },
};

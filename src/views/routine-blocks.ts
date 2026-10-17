import type { NativeEvent, NativeNode } from "@anvil/app-sdk/author";
import {
  button,
  literal,
  ref,
  type Binding,
  type FieldPath,
} from "./helpers.js";
import { join } from "./structure-labels.js";

export const routineBlocks: Binding = {
  op: "coalesce",
  left: ref("form", ["value", "blocks"], "routine"),
  right: literal([]),
};
const occurrencePath: FieldPath = [
  "value",
  "occurrences",
  { itemIndex: "occurrence" },
];
const safe = (value: Binding, fallback: Binding): Binding => ({
  op: "coalesce",
  left: value,
  right: fallback,
});
const occurrences = safe(
  ref("form", ["value", "occurrences"], "routine"),
  literal([]),
);
const sets = safe(
  ref("form", [...occurrencePath, "sets"], "routine"),
  literal([]),
);
const key = (name: string) => safe(ref("item", ["key"], name), literal(""));
const changeSets = (value: Binding): NativeEvent[] => [
  {
    op: "set-form",
    form: "routine",
    path: [...occurrencePath, "sets"],
    value,
  },
];
const length = (value: Binding): Binding => ({ op: "length", value });
export const pickExercise = (): NativeEvent[] => [
  { op: "open-dialog", dialog: "exercise-picker" },
];
export const blocksEditor: NativeNode = {
  id: "routine-block",
  component: "stack",
  props: { gap: "normal" },
  children: [
    {
      id: "block-settings",
      component: "grid",
      props: { columns: 2, gap: "normal" },
      children: [
        {
          id: "block-kind",
          component: "select",
          props: {
            label: "Block",
            form: "routine",
            path: ["value", "kind"],
            options: [
              { value: "single", label: "Single" },
              { value: "superset", label: "Superset" },
              { value: "circuit", label: "Circuit" },
            ],
          },
        },
        {
          id: "block-rounds",
          component: "number-field",
          props: {
            label: "Rounds",
            form: "routine",
            path: ["value", "rounds"],
          },
        },
      ],
    },
    {
      id: "routine-occurrences",
      component: "list",
      props: {
        items: {
          op: "map",
          source: {
            op: "filter",
            source: literal(
              Array.from({ length: 12 }, (_, i) => ({ index: i })),
            ),
            as: "candidate-slot",
            maxItems: 12,
            value: {
              op: "less",
              left: ref("item", ["index"], "candidate-slot"),
              right: length(occurrences),
            },
          },
          as: "slot",
          maxItems: 12,
          value: {
            op: "object",
            fields: {
              index: ref("item", ["index"], "slot"),
              key: safe(
                ref(
                  "form",
                  ["value", "occurrences", { itemIndex: "slot" }, "key"],
                  "routine",
                ),
                literal(""),
              ),
            },
          },
        },
        as: "occurrence",
        key: ["key"],
        maxItems: 12,
      },
      template: {
        id: "routine-exercise",
        component: "card",
        props: { gap: "small" },
        children: [
          {
            id: "routine-exercise-name",
            component: "heading",
            props: {
              text: join(
                {
                  op: "format",
                  format: "number",
                  digits: 0,
                  value: {
                    op: "add",
                    left: ref("item", ["index"], "occurrence"),
                    right: literal(1),
                  },
                },
                safe(
                  ref(
                    "form",
                    [...occurrencePath, "snapshot", "name"],
                    "routine",
                  ),
                  literal("Exercise"),
                ),
                ". ",
              ),
              level: 3,
            },
          },
          {
            id: "routine-set-settings",
            component: "grid",
            props: { columns: 2, gap: "normal" },
            children: [
              {
                id: "routine-set-actions",
                component: "stack",
                props: { gap: "small" },
                children: [
                  {
                    id: "routine-set-count",
                    component: "text",
                    props: {
                      text: {
                        op: "concat",
                        left: {
                          op: "format",
                          format: "number",
                          value: length(sets),
                          digits: 0,
                        },
                        right: literal(" sets / round"),
                      },
                    },
                  },
                  {
                    id: "routine-set-controls",
                    component: "row",
                    props: { gap: "small", wrap: true },
                    children: [
                      button(
                        "add-routine-set",
                        "Add set",
                        changeSets({
                          op: "append",
                          source: sets,
                          value: literal({ kind: "working", values: [] }),
                          maxItems: 20,
                        }),
                        "secondary",
                        {
                          op: "greater",
                          left: length(sets),
                          right: literal(19),
                        },
                      ),
                      button(
                        "remove-routine-set",
                        "Remove last set",
                        changeSets({
                          op: "remove-at",
                          source: sets,
                          index: {
                            op: "subtract",
                            left: length(sets),
                            right: literal(1),
                          },
                          maxItems: 20,
                        }),
                        "ghost",
                        { op: "less", left: length(sets), right: literal(2) },
                      ),
                    ],
                  },
                ],
              },
              {
                id: "routine-exercise-options",
                component: "stack",
                props: { gap: "small" },
                children: [
                  {
                    id: "routine-rest",
                    component: "number-field",
                    props: {
                      label: "Rest (s)",
                      form: "routine",
                      path: [...occurrencePath, "restSeconds"],
                    },
                  },
                  button(
                    "remove-routine-exercise",
                    "Remove exercise",
                    [
                      {
                        op: "set-form",
                        form: "routine",
                        path: ["value", "occurrences"],
                        value: {
                          op: "filter",
                          source: occurrences,
                          as: "candidate",
                          maxItems: 12,
                          value: {
                            op: "not",
                            value: {
                              op: "equal",
                              left: key("candidate"),
                              right: safe(
                                ref(
                                  "form",
                                  [...occurrencePath, "key"],
                                  "routine",
                                ),
                                literal(""),
                              ),
                            },
                          },
                        },
                      },
                    ],
                    "ghost",
                    {
                      op: "less",
                      left: length(occurrences),
                      right: literal(2),
                    },
                  ),
                ],
              },
            ],
          },
        ],
      },
    },
    {
      ...button(
        "add-block-exercise",
        "Add exercise",
        pickExercise(),
        "secondary",
        { op: "greater", left: length(occurrences), right: literal(11) },
      ),
      visible: {
        op: "not",
        value: {
          op: "equal",
          left: safe(
            ref("form", ["value", "kind"], "routine"),
            literal("single"),
          ),
          right: literal("single"),
        },
      },
    },
  ],
};

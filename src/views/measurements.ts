import type { NativeNode } from "@anvil/app-sdk/author";
import {
  button,
  checkbox,
  field,
  grid,
  heading,
  literal,
  number,
  object,
  ref,
  select,
  stack,
  type FieldPath,
} from "./helpers.js";

const metrics = {
  op: "coalesce" as const,
  left: ref("form", ["value", "metrics"], "exercise"),
  right: literal([]),
};
const path = (name: string): FieldPath => [
  "value",
  "metrics",
  { itemIndex: "metric" },
  name,
];

export const measurementEditor: NativeNode = stack("measurements", [
  heading("measurement-heading", "Measurements"),
  {
    id: "measurement-list",
    component: "list",
    props: {
      items: {
        op: "map",
        source: metrics,
        as: "definition",
        maxItems: 12,
        value: object({
          key: {
            op: "coalesce",
            left: ref("item", ["key"], "definition"),
            right: literal(""),
          },
        }),
      },
      as: "metric",
      key: ["key"],
      maxItems: 12,
    },
    template: {
      id: "measurement-card",
      component: "card",
      props: { gap: "normal" },
      children: [
        grid("measurement-fields", [
          field("measurement-label", "Measurement", path("label")),
          field("measurement-unit", "Unit", path("unit")),
        ]),
        {
          id: "measurement-options",
          component: "condition",
          props: { when: ref("state", ["measurementOptions"]) },
          then: stack("measurement-details", [
            grid("measurement-types", [
              select("measurement-kind", "Number type", path("kind"), [
                { value: "integer", label: "Whole number" },
                { value: "decimal", label: "Decimal" },
              ]),
              select("measurement-dimension", "Measures", path("dimension"), [
                "count",
                "mass",
                "length",
                "duration",
                "custom",
              ]),
              select(
                "measurement-load",
                "Weight meaning",
                path("loadMeaning"),
                [
                  { value: "none", label: "Not a weight" },
                  { value: "total", label: "Total weight" },
                  { value: "per-dumbbell", label: "Per dumbbell" },
                  { value: "added", label: "Added weight" },
                  { value: "assistance", label: "Assistance" },
                ],
              ),
              number(
                "measurement-precision",
                "Decimal places",
                path("precision"),
              ),
              number("measurement-minimum", "Minimum", path("minimum")),
              number("measurement-maximum", "Maximum", path("maximum")),
            ]),
            checkbox(
              "measurement-required",
              "Required when recording a set",
              path("required"),
            ),
            checkbox(
              "measurement-signed",
              "Allow negative values",
              path("signed"),
            ),
          ]),
        },
        {
          ...button(
            "remove-measurement",
            "Remove measurement",
            [
              {
                op: "set-form",
                form: "exercise",
                path: ["value", "metrics"],
                value: {
                  op: "filter",
                  source: metrics,
                  as: "candidate",
                  maxItems: 12,
                  value: {
                    op: "not",
                    value: {
                      op: "equal",
                      left: {
                        op: "coalesce",
                        left: ref("item", ["key"], "candidate"),
                        right: literal(""),
                      },
                      right: {
                        op: "coalesce",
                        left: ref("item", ["key"], "metric"),
                        right: literal(""),
                      },
                    },
                  },
                },
              },
            ],
            "ghost",
          ),
          visible: {
            op: "greater",
            left: { op: "length", value: metrics },
            right: literal(1),
          },
        },
      ],
    },
  },
  {
    id: "measurement-controls",
    component: "row",
    props: { gap: "small", wrap: true },
    children: [
      {
        id: "add-measurement",
        component: "button",
        props: {
          label: "Add measurement",
          tone: "secondary",
          disabled: {
            op: "greater",
            left: { op: "length", value: metrics },
            right: literal(11),
          },
        },
        onPress: [
          {
            op: "invoke",
            action: "new-measurement",
            input: literal({}),
            onSuccess: [
              {
                op: "set-form",
                form: "exercise",
                path: ["value", "metrics"],
                value: {
                  op: "append",
                  source: metrics,
                  value: ref("event"),
                  maxItems: 12,
                },
              },
            ],
            onFailure: [],
          },
        ],
      },
      button(
        "toggle-measurement-options",
        "Measurement options",
        [
          {
            op: "set-state",
            path: ["measurementOptions"],
            value: { op: "not", value: ref("state", ["measurementOptions"]) },
          },
        ],
        "ghost",
      ),
    ],
  },
]);

import type { NativeEvent, NativeNode } from "@anvil/app-sdk/author";
import {
  button,
  heading,
  literal,
  navigate,
  object,
  ref,
  type Binding,
} from "./helpers.js";
import { setLabel, source, workoutView } from "./workout-helpers.js";
import { join } from "./structure-labels.js";

const row = (name: string, key: string) => ref("item", [key], name);
const identity = (name: string) =>
  object({ id: row(name, "id"), revision: row(name, "revision") });
const hasActual: Binding = {
  op: "greater",
  left: { op: "length", value: ref("item", ["data", "actual"], "set") },
  right: literal(0),
};
const refresh: NativeEvent = { op: "refresh-source", source: "sets" };
const emptyUndo = {
  available: false,
  firstId: "00000000-0000-0000-0000-000000000000",
  firstRevision: 0,
  secondId: "00000000-0000-0000-0000-000000000000",
  secondRevision: 0,
};
const undoState = object({
  available: literal(true),
  firstId: ref("event", ["first", "id"]),
  firstRevision: ref("event", ["first", "revision"]),
  secondId: ref("event", ["second", "id"]),
  secondRevision: ref("event", ["second", "revision"]),
});
const swap = (first: Binding, second: Binding, undo = false): NativeEvent[] => [
  {
    op: "invoke",
    action: "swap-workout-sets",
    input: object({ occurrenceId: ref("params", ["id"]), first, second }),
    onSuccess: [
      {
        op: "set-state",
        path: [],
        value: undo ? literal(emptyUndo) : undoState,
      },
      refresh,
    ],
    onFailure: [],
  },
];
const neighbour = (direction: "up" | "down"): NativeNode => ({
  id: `move-${direction}-candidate`,
  component: "list",
  props: {
    items: {
      op: "filter",
      source: ref("source", ["records"], "sets"),
      as: "candidate",
      maxItems: 10,
      value: {
        op: "equal",
        left: ref("item", ["data", "position"], "candidate"),
        right: {
          op: direction === "up" ? "subtract" : "add",
          left: ref("item", ["data", "position"], "set"),
          right: literal(1),
        },
      },
    },
    as: "neighbour",
    key: ["id"],
    maxItems: 1,
  },
  template: button(
    `move-${direction}`,
    direction === "up" ? "Move up" : "Move down",
    swap(identity("set"), identity("neighbour")),
  ),
});

export const workoutSetOrder = workoutView({
  id: "workout-set-order",
  label: "Set order",
  entity: true,
  state: {
    schema: {
      type: "object",
      properties: {
        available: { type: "boolean" },
        firstId: { type: "string", minLength: 36, maxLength: 36 },
        firstRevision: { type: "integer" },
        secondId: { type: "string", minLength: 36, maxLength: 36 },
        secondRevision: { type: "integer" },
      },
      required: [
        "available",
        "firstId",
        "firstRevision",
        "secondId",
        "secondRevision",
      ],
      additionalProperties: false,
    },
    initial: emptyUndo,
  },
  actions: ["get-workout-exercise", "list-workout-sets", "swap-workout-sets"],
  sources: [
    source(
      "exercise",
      "get-workout-exercise",
      object({ id: ref("params", ["id"]) }),
    ),
    source(
      "sets",
      "list-workout-sets",
      object({ occurrenceId: ref("params", ["id"]) }),
    ),
  ],
  forms: [],
  root: {
    id: "set-order",
    component: "page",
    props: { gap: "normal", align: "stretch" },
    children: [
      button(
        "back-sets",
        "Sets",
        navigate("workout-exercise", object({ id: ref("params", ["id"]) })),
        "ghost",
      ),
      heading("set-order-heading", "Set order", 1),
      {
        id: "exercise-name",
        component: "text",
        props: {
          text: ref("source", ["data", "snapshot", "name"], "exercise"),
        },
      },
      {
        ...button(
          "undo-order",
          "Undo",
          swap(
            object({
              id: ref("state", ["firstId"]),
              revision: ref("state", ["firstRevision"]),
            }),
            object({
              id: ref("state", ["secondId"]),
              revision: ref("state", ["secondRevision"]),
            }),
            true,
          ),
          "ghost",
        ),
        visible: ref("state", ["available"]),
      },
      {
        id: "ordered-sets",
        component: "list",
        props: {
          items: ref("source", ["records"], "sets"),
          as: "set",
          key: ["id"],
          maxItems: 10,
        },
        template: {
          id: "ordered-set",
          component: "card",
          props: { gap: "small" },
          children: [
            {
              id: "set-order-row",
              component: "row",
              props: { gap: "normal", align: "center", wrap: false },
              children: [
                {
                  id: "set-information",
                  component: "stack",
                  props: { gap: "small" },
                  children: [
                    {
                      id: "set-heading",
                      component: "heading",
                      props: { text: setLabel(), level: 2 },
                    },
                    {
                      id: "set-kind",
                      component: "text",
                      props: {
                        text: join(ref("item", ["data", "kind"], "set"), {
                          op: "if",
                          condition: ref("item", ["data", "completed"], "set"),
                          then: literal("Done"),
                          else: literal("Pending"),
                        }),
                      },
                    },
                    {
                      id: "set-values",
                      component: "list",
                      props: {
                        items: {
                          op: "if",
                          condition: hasActual,
                          then: ref("item", ["data", "actual"], "set"),
                          else: ref("item", ["data", "planned"], "set"),
                        },
                        as: "measurement",
                        key: ["key"],
                        maxItems: 12,
                      },
                      template: {
                        id: "set-value",
                        component: "text",
                        props: {
                          text: join(
                            {
                              op: "concat",
                              left: {
                                op: "if",
                                condition: hasActual,
                                then: literal(""),
                                else: literal("Target: "),
                              },
                              right: {
                                op: "format",
                                format: "number",
                                value: ref("item", ["value"], "measurement"),
                              },
                            },
                            ref("item", ["unit"], "measurement"),
                            " ",
                          ),
                        },
                      },
                    },
                    {
                      id: "set-notes",
                      component: "text",
                      props: { text: ref("item", ["data", "notes"], "set") },
                      visible: {
                        op: "not",
                        value: {
                          op: "equal",
                          left: ref("item", ["data", "notes"], "set"),
                          right: literal(""),
                        },
                      },
                    },
                  ],
                },
                {
                  id: "set-move",
                  component: "stack",
                  props: { gap: "small" },
                  children: [neighbour("up"), neighbour("down")],
                },
              ],
            },
          ],
        },
      },
    ],
  },
});

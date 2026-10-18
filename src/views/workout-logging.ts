import type { NativeNode } from "@anvil/app-sdk/author";
import {
  button,
  literal,
  navigate,
  object,
  ref,
  text,
  type Binding,
} from "./helpers.js";
import { paramsId, source, workoutView } from "./workout-helpers.js";
import { countLabel, groupLabel, join } from "./structure-labels.js";

const safe = (left: Binding, right: Binding): Binding => ({
  op: "coalesce",
  left,
  right,
});
const setPath = ["sets", { itemIndex: "set" }] as const;
const metrics = ["exercise", "data", "snapshot", "metrics"] as const;
const sourceValue = (...path: (string | number | { itemIndex: string })[]) =>
  ref("source", path, "logging");
const submit = {
  op: "submit-form" as const,
  form: "logging",
  onSuccess: [],
  onFailure: [],
};
const detailsOpen: Binding = {
  op: "equal",
  left: ref("state", ["details"]),
  right: ref("item", ["id"], "set"),
};
const setNumber: Binding = {
  op: "add",
  left: safe(
    sourceValue("records", { itemIndex: "set" }, "data", "position"),
    literal(0),
  ),
  right: literal(1),
};
const metric = (index: number | "extra"): NativeNode => {
  const definition = (key: string, fallback: Binding): Binding =>
    index === "extra"
      ? ref("item", [key], "metric")
      : safe(sourceValue(...metrics, index, key), fallback);
  const field: NativeNode = {
    id: `metric-${index}`,
    component: "measurement-field",
    props: {
      form: "logging",
      path: [
        ...setPath,
        "values",
        index === "extra" ? { itemIndex: "metric" } : index,
        "value",
      ],
      label: definition("label", literal("Measurement")),
      unit: definition("unit", literal("")),
      metricId: definition("key", literal("")),
      metricVersion: definition("version", literal(1)),
    },
  };
  const group: NativeNode = {
    id: `metric-${index}-group`,
    component: "stack",
    props: { gap: "small" },
    children: [
      field,
      {
        id: `metric-${index}-targets`,
        component: "list",
        props: {
          items: {
            op: "filter",
            source: safe(
              sourceValue("sets", { itemIndex: "set" }, "targets"),
              literal([]),
            ),
            as: "candidate-target",
            maxItems: 12,
            value: {
              op: "equal",
              left: ref("item", ["key"], "candidate-target"),
              right: definition("key", literal("")),
            },
          },
          as: "target",
          key: ["key"],
          maxItems: 1,
        },
        template: text(
          `metric-${index}-target`,
          join(
            literal("Target"),
            {
              op: "format",
              format: "number",
              value: ref("item", ["value"], "target"),
            },
            ": ",
          ),
        ),
      },
    ],
  };
  if (index === "extra") return group;
  return {
    id: `metric-${index}-present`,
    component: "condition",
    props: { when: { op: "present", value: sourceValue(...metrics, index) } },
    then: group,
  };
};
export const workoutLogging = workoutView({
  id: "workout-exercise",
  label: "Workout exercise",
  entity: true,
  state: {
    schema: {
      type: "object",
      properties: { details: { type: "string", maxLength: 36 } },
      required: ["details"],
      additionalProperties: false,
    },
    initial: { details: "" },
  },
  actions: ["get-workout-logging", "record-workout-logging", "add-workout-set"],
  sources: [source("logging", "get-workout-logging", paramsId())],
  forms: [
    {
      id: "logging",
      action: "record-workout-logging",
      commit: "autosave",
      initial: object({
        occurrenceId: ref("params", ["id"]),
        sets: {
          op: "map",
          source: sourceValue("sets"),
          as: "initial",
          value: ref("item", ["draft"], "initial"),
          maxItems: 10,
        },
      }),
      onSuccess: [
        {
          op: "set-form",
          form: "logging",
          path: ["sets"],
          value: ref("event", ["sets"]),
        },
      ],
    },
  ],
  root: {
    id: "workout-logging",
    component: "page",
    props: { gap: "normal", align: "start" },
    children: [
      button(
        "back-workout",
        "Workout",
        [
          submit,
          ...navigate(
            "workout",
            object({ id: sourceValue("exercise", "data", "sessionId") }),
          ),
        ],
        "ghost",
      ),
      {
        id: "exercise-heading",
        component: "heading",
        props: {
          text: sourceValue("exercise", "data", "snapshot", "name"),
          level: 1,
        },
      },
      {
        id: "group-visible",
        component: "condition",
        props: {
          when: {
            op: "not",
            value: {
              op: "equal",
              left: sourceValue("block", "data", "kind"),
              right: literal("single"),
            },
          },
        },
        then: text(
          "group",
          join(
            groupLabel(
              sourceValue("block", "data", "kind"),
              sourceValue("block", "data", "position"),
            ),
            countLabel(sourceValue("block", "data", "rounds"), "round"),
          ),
        ),
      },
      {
        id: "sets",
        component: "list",
        props: {
          items: {
            op: "map",
            source: safe(ref("form", ["sets"], "logging"), literal([])),
            as: "logging-set",
            maxItems: 10,
            value: object({
              id: safe(ref("item", ["id"], "logging-set"), literal("")),
            }),
          },
          as: "set",
          key: ["id"],
          maxItems: 10,
        },
        template: {
          id: "set-row",
          component: "section",
          props: { gap: "small" },
          children: [
            {
              id: "set-entry",
              component: "row",
              props: { gap: "small", align: "end", wrap: false },
              children: [
                ...Array.from({ length: 10 }, (_, index): NativeNode => ({
                  ...button(
                    `set-${index}-details`,
                    `${index + 1} ▾`,
                    [
                      {
                        op: "set-state",
                        path: ["details"],
                        value: {
                          op: "if",
                          condition: detailsOpen,
                          then: literal(""),
                          else: ref("item", ["id"], "set"),
                        },
                      },
                    ],
                    "secondary",
                  ),
                  visible: {
                    op: "equal",
                    left: setNumber,
                    right: literal(index + 1),
                  },
                })),
                metric(0),
                metric(1),
                {
                  id: "set-completed",
                  component: "checkbox",
                  props: {
                    form: "logging",
                    path: [...setPath, "completed"],
                    label: "Done",
                  },
                },
              ],
            },
            {
              id: "details",
              component: "condition",
              props: { when: detailsOpen },
              then: {
                id: "set-options",
                component: "stack",
                props: { gap: "normal" },
                children: [
                  {
                    id: "other-metrics",
                    component: "list",
                    props: {
                      items: sourceValue(...metrics),
                      as: "metric",
                      key: ["key"],
                      maxItems: 12,
                    },
                    template: {
                      id: "extra-metric-visible",
                      component: "condition",
                      props: {
                        when: {
                          op: "not",
                          value: {
                            op: "or",
                            left: {
                              op: "equal",
                              left: ref("item", ["key"], "metric"),
                              right: safe(
                                sourceValue(...metrics, 0, "key"),
                                literal(""),
                              ),
                            },
                            right: {
                              op: "equal",
                              left: ref("item", ["key"], "metric"),
                              right: safe(
                                sourceValue(...metrics, 1, "key"),
                                literal(""),
                              ),
                            },
                          },
                        },
                      },
                      then: metric("extra"),
                    },
                  },
                  {
                    id: "set-kind",
                    component: "select",
                    props: {
                      form: "logging",
                      path: [...setPath, "kind"],
                      label: "Set type",
                      options: [
                        { value: "working", label: "Working" },
                        { value: "warmup", label: "Warm-up" },
                        { value: "drop", label: "Drop set" },
                      ],
                    },
                  },
                  {
                    id: "set-notes",
                    component: "text-field",
                    props: {
                      form: "logging",
                      path: [...setPath, "notes"],
                      label: "Notes",
                      multiline: true,
                    },
                  },
                ],
              },
            },
            { id: "set-divider", component: "divider", props: {} },
          ],
        },
      },
      button("add-set", "Add set", [
        submit,
        {
          op: "invoke",
          action: "add-workout-set",
          input: object({ occurrenceId: ref("params", ["id"]) }),
          onSuccess: [{ op: "refresh-source", source: "logging" }],
          onFailure: [],
        },
      ]),
    ],
  },
});

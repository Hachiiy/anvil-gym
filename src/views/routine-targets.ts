import {
  button,
  literal,
  navigate,
  object,
  ref,
  type FieldPath,
} from "./helpers.js";
import { page, revisionHook, source, workoutView } from "./workout-helpers.js";

const identityFields = {
  id: ref("params", ["id"]),
  blockKey: ref("params", ["blockKey"]),
  occurrenceKey: ref("params", ["occurrenceKey"]),
};
const identity = object(identityFields);
const valuesPath: FieldPath = [
  "sets",
  { itemIndex: "target-set" },
  "values",
  { itemIndex: "metric" },
  "value",
];
const submit = {
  op: "submit-form" as const,
  form: "targets",
  onSuccess: [],
  onFailure: [],
};
export const routineTargets = workoutView({
  id: "routine-targets",
  label: "Routine targets",
  paramsSchema: {
    type: "object",
    properties: Object.fromEntries(
      ["id", "blockKey", "occurrenceKey"].map((key) => [
        key,
        { type: "string", minLength: 36, maxLength: 36 },
      ]),
    ),
    required: ["id", "blockKey", "occurrenceKey"],
    additionalProperties: false,
  },
  actions: ["get-routine-targets", "record-routine-targets"],
  sources: [source("editor", "get-routine-targets", identity)],
  forms: [
    {
      id: "targets",
      action: "record-routine-targets",
      commit: "autosave",
      initial: object({
        ...identityFields,
        revision: ref("source", ["revision"], "editor"),
        sets: ref("source", ["sets"], "editor"),
      }),
      onSuccess: revisionHook("targets"),
    },
  ],
  root: page("routine-targets", [
    button(
      "back-exercise",
      "Exercise",
      [
        submit,
        ...navigate(
          "routine-block",
          object({
            id: ref("params", ["id"]),
            blockKey: ref("params", ["blockKey"]),
          }),
        ),
      ],
      "ghost",
    ),
    {
      id: "exercise-heading",
      component: "heading",
      props: { text: ref("source", ["name"], "editor"), level: 1 },
    },
    {
      id: "planned-sets",
      component: "list",
      props: {
        items: {
          op: "filter",
          source: literal(
            Array.from({ length: 20 }, (_, index) => ({ index })),
          ),
          as: "candidate-set",
          maxItems: 20,
          value: {
            op: "less",
            left: ref("item", ["index"], "candidate-set"),
            right: { op: "length", value: ref("source", ["sets"], "editor") },
          },
        },
        as: "target-set",
        key: ["index"],
        maxItems: 20,
      },
      template: {
        id: "planned-set",
        component: "section",
        props: { gap: "small" },
        children: [
          {
            id: "set-name",
            component: "heading",
            props: {
              level: 2,
              text: {
                op: "concat",
                left: literal("Set "),
                right: {
                  op: "format",
                  format: "number",
                  digits: 0,
                  value: {
                    op: "add",
                    left: ref("item", ["index"], "target-set"),
                    right: literal(1),
                  },
                },
              },
            },
          },
          {
            id: "target-measurements",
            component: "list",
            props: {
              items: ref("source", ["definitions"], "editor"),
              as: "metric",
              key: ["key"],
              maxItems: 12,
            },
            template: {
              id: "target-measurement",
              component: "measurement-field",
              props: {
                form: "targets",
                path: valuesPath,
                label: ref("item", ["label"], "metric"),
                unit: ref("item", ["unit"], "metric"),
                metricId: ref("item", ["key"], "metric"),
                metricVersion: ref("item", ["version"], "metric"),
              },
            },
          },
        ],
      },
    },
  ]),
});

import {
  button,
  literal,
  navigate,
  object,
  ref,
  select,
  text,
} from "./helpers.js";
import {
  entityLink,
  formField,
  page,
  paramsId,
  revisionHook,
  source,
  workoutView,
} from "./workout-helpers.js";

export const workoutSet = workoutView({
  id: "workout-set",
  label: "Set",
  entity: true,
  actions: ["get-set-editor", "record-workout-set"],
  sources: [source("editor", "get-set-editor", paramsId())],
  forms: [
    {
      id: "set",
      action: "record-workout-set",
      commit: "autosave",
      initial: object({
        id: ref("source", ["set", "id"], "editor"),
        revision: ref("source", ["set", "revision"], "editor"),
        values: ref("source", ["values"], "editor"),
        completed: ref("source", ["set", "data", "completed"], "editor"),
        kind: ref("source", ["set", "data", "kind"], "editor"),
        notes: ref("source", ["set", "data", "notes"], "editor"),
      }),
      onSuccess: revisionHook("set"),
    },
  ],
  root: page("workout-set", [
    button(
      "back-sets",
      "Exercise sets",
      navigate(
        "workout-exercise",
        entityLink(["set", "data", "occurrenceId"], "editor"),
      ),
      "ghost",
    ),
    {
      id: "set-heading",
      component: "heading",
      props: {
        text: ref("source", ["occurrence", "data", "snapshot", "name"], "editor"),
        level: 1,
      },
    },
    {
      id: "set-ordinal",
      component: "text",
      props: {
        text: {
          op: "concat",
          left: literal("Record set "),
          right: {
            op: "format",
            format: "number",
            value: {
              op: "add",
              left: ref("source", ["set", "data", "position"], "editor"),
              right: literal(1),
            },
            digits: 0,
          },
        },
      },
    },
    text(
      "set-help",
      "Leave unknown values blank. Zero is a recorded value. Changes save automatically.",
    ),
    {
      id: "set-measurements",
      component: "list",
      props: {
        items: ref(
          "source",
          ["occurrence", "data", "snapshot", "metrics"],
          "editor",
        ),
        as: "metric",
        key: ["key"],
        maxItems: 12,
      },
      template: {
        id: "set-measurement",
        component: "measurement-field",
        props: {
          form: "set",
          path: ["values", { itemIndex: "metric" }, "value"],
          label: ref("item", ["label"], "metric"),
          unit: ref("item", ["unit"], "metric"),
          metricId: ref("item", ["key"], "metric"),
          metricVersion: ref("item", ["version"], "metric"),
        },
      },
    },
    {
      id: "set-kind",
      component: "select",
      props: {
        form: "set",
        path: ["kind"],
        label: "Set type",
        options: [
          { value: "warmup", label: "Warm-up" },
          { value: "working", label: "Working" },
          { value: "drop", label: "Drop set" },
        ],
      },
    },
    {
      id: "set-completed",
      component: "checkbox",
      props: { form: "set", path: ["completed"], label: "Set completed" },
    },
    formField("set-notes", "Set notes", "set", ["notes"], true),
  ]),
});

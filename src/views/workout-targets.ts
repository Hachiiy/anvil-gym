import { button, literal, navigate, object, ref, text } from "./helpers.js";
import { join } from "./structure-labels.js";
import {
  entityLink,
  page,
  paramsId,
  revisionHook,
  source,
  workoutView,
} from "./workout-helpers.js";

const submit = {
  op: "submit-form" as const,
  form: "targets",
  onSuccess: [],
  onFailure: [],
};
export const workoutTargets = workoutView({
  id: "workout-targets",
  label: "Set targets",
  entity: true,
  actions: ["get-set-editor", "previous-workout-targets", "plan-workout-set"],
  sources: [
    source("editor", "get-set-editor", paramsId()),
    source("previous", "previous-workout-targets", paramsId()),
  ],
  forms: [
    {
      id: "targets",
      action: "plan-workout-set",
      commit: "autosave",
      initial: object({
        id: ref("source", ["set", "id"], "editor"),
        revision: ref("source", ["set", "revision"], "editor"),
        values: ref("source", ["plannedValues"], "editor"),
      }),
      onSuccess: revisionHook("targets"),
    },
  ],
  root: page("workout-targets", [
    button(
      "back-exercise",
      "Exercise",
      [
        submit,
        ...navigate(
          "workout-exercise",
          entityLink(["set", "data", "occurrenceId"], "editor"),
        ),
      ],
      "ghost",
    ),
    {
      id: "targets-heading",
      component: "heading",
      props: {
        text: join(
          join(
            literal("Set"),
            {
              op: "format",
              format: "number",
              digits: 0,
              value: ref("source", ["ordinal"], "editor"),
            },
            " ",
          ),
          literal("targets"),
          " ",
        ),
        level: 1,
      },
    },
    text(
      "exercise-name",
      ref("source", ["occurrence", "data", "snapshot", "name"], "editor"),
    ),
    {
      id: "previous-controls",
      component: "row",
      props: { gap: "small", align: "center" },
      children: [
        button(
          "use-previous",
          "Use previous",
          [
            {
              op: "set-form",
              form: "targets",
              path: ["values"],
              value: ref("source", ["values"], "previous"),
            },
            submit,
          ],
          "secondary",
          { op: "not", value: ref("source", ["available"], "previous") },
        ),
        {
          id: "previous-date",
          component: "condition",
          props: { when: ref("source", ["available"], "previous") },
          then: text("previous-date-value", {
            op: "coalesce",
            left: ref("source", ["source", "dateKey"], "previous"),
            right: literal(""),
          }),
        },
      ],
    },
    {
      id: "planned-measurements",
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
        id: "planned-measurement",
        component: "measurement-field",
        props: {
          form: "targets",
          path: ["values", { itemIndex: "metric" }, "value"],
          label: ref("item", ["label"], "metric"),
          unit: ref("item", ["unit"], "metric"),
          metricId: ref("item", ["key"], "metric"),
          metricVersion: ref("item", ["version"], "metric"),
        },
      },
    },
  ]),
});

import type { NativeNode } from "@anvil/app-sdk/author";
import { button, literal, navigate, object, ref, text } from "./helpers.js";
import { join } from "./structure-labels.js";
import {
  cardName,
  compareName,
  copyButton,
  loggingValue,
  safe,
  submitCards,
} from "./overview-helpers.js";

const setPath = ["sets", { itemIndex: "set" }] as const;
function metric(slot: number, index: number): NativeNode {
  const definition = (field: string) =>
    safe(
      loggingValue(
        slot,
        "exercise",
        "data",
        "snapshot",
        "metrics",
        index,
        field,
      ),
      literal(field === "version" ? 1 : field === "label" ? "Measurement" : ""),
    );
  return {
    id: `metric-present-${slot}-${index}`,
    component: "condition",
    props: {
      when: {
        op: "present",
        value: loggingValue(
          slot,
          "exercise",
          "data",
          "snapshot",
          "metrics",
          index,
        ),
      },
    },
    then: {
      id: `metric-${slot}-${index}`,
      component: "measurement-field",
      props: {
        form: cardName(slot),
        path: [...setPath, "values", index, "value"],
        label: definition("label"),
        unit: definition("unit"),
        metricId: definition("key"),
        metricVersion: definition("version"),
      },
    },
  };
}
function measured(
  value: import("./helpers.js").Binding,
): import("./helpers.js").Binding {
  return {
    op: "if",
    condition: { op: "present", value },
    then: { op: "format", format: "number", value: safe(value, literal(0)) },
    else: literal("—"),
  };
}
function valuesLabel(
  slot: number,
  previous = false,
): import("./helpers.js").Binding {
  const value = (index: number) =>
    previous
      ? ref("item", ["values", index, "value"], "comparison")
      : loggingValue(
          slot,
          "sets",
          { itemIndex: "set" },
          "planned",
          index,
          "value",
        );
  const unit = (index: number) =>
    safe(
      loggingValue(
        slot,
        "exercise",
        "data",
        "snapshot",
        "metrics",
        index,
        "unit",
      ),
      literal(""),
    );
  const first = join(measured(value(0)), unit(0), " ");
  return join(
    literal(previous ? "Previous" : "Plan"),
    {
      op: "if",
      condition: {
        op: "present",
        value: loggingValue(slot, "exercise", "data", "snapshot", "metrics", 1),
      },
      then: join(first, join(measured(value(1)), unit(1), " "), " · "),
      else: first,
    },
    " · ",
  );
}
function comparison(slot: number): NativeNode {
  return {
    id: `comparison-${slot}`,
    component: "list",
    props: {
      items: {
        op: "filter",
        source: safe(
          ref("source", ["records"], compareName(slot)),
          literal([]),
        ),
        as: "candidate",
        maxItems: 10,
        value: {
          op: "equal",
          left: ref("item", ["id"], "candidate"),
          right: ref("item", ["id"], "set"),
        },
      },
      as: "comparison",
      key: ["id"],
      maxItems: 1,
    },
    template: {
      id: `comparison-row-${slot}`,
      component: "condition",
      props: { when: ref("item", ["available"], "comparison") },
      then: {
        id: `previous-values-${slot}`,
        component: "row",
        props: { gap: "small", wrap: true, align: "center" },
        children: [
          text(`previous-numbers-${slot}`, valuesLabel(slot, true)),
          {
            ...text(
              `different-previous-date-${slot}`,
              ref("item", ["dateKey"], "comparison"),
            ),
            visible: {
              op: "not",
              value: {
                op: "equal",
                left: ref("item", ["dateKey"], "comparison"),
                right: ref("source", ["dateKey"], compareName(slot)),
              },
            },
          },
          copyButton(slot, true),
        ],
      },
    },
  };
}
export function overviewCard(slot: number): NativeNode {
  return {
    id: `card-present-${slot}`,
    component: "condition",
    props: { when: { op: "present", value: loggingValue(slot, "exercise") } },
    then: {
      id: `exercise-card-${slot}`,
      component: "card",
      props: { gap: "small" },
      children: [
        {
          id: `exercise-heading-${slot}`,
          component: "heading",
          props: {
            text: safe(
              loggingValue(slot, "exercise", "data", "snapshot", "name"),
              literal("Exercise"),
            ),
            level: 2,
          },
        },
        text(
          `equipment-${slot}`,
          safe(
            loggingValue(slot, "exercise", "data", "snapshot", "equipment"),
            literal(""),
          ),
        ),
        {
          ...text(
            `previous-date-${slot}`,
            join(
              literal("Previous workout"),
              ref("source", ["dateKey"], compareName(slot)),
              " · ",
            ),
          ),
          visible: {
            op: "and",
            left: {
              op: "present",
              value: ref("source", ["dateKey"], compareName(slot)),
            },
            right: {
              op: "not",
              value: {
                op: "equal",
                left: ref("source", ["dateKey"], compareName(slot)),
                right: literal(""),
              },
            },
          },
        },
        {
          id: `card-sets-${slot}`,
          component: "list",
          props: {
            items: loggingValue(slot, "records"),
            as: "set",
            key: ["id"],
            maxItems: 10,
          },
          template: {
            id: `set-row-${slot}`,
            component: "section",
            props: { gap: "small" },
            children: [
              {
                id: `set-inputs-${slot}`,
                component: "row",
                props: { gap: "small", align: "end", wrap: false },
                children: [
                  text(`set-number-${slot}`, {
                    op: "format",
                    format: "number",
                    digits: 0,
                    value: loggingValue(slot, "ordinals", { itemIndex: "set" }),
                  }),
                  metric(slot, 0),
                  metric(slot, 1),
                  {
                    id: `set-done-${slot}`,
                    component: "checkbox",
                    props: {
                      form: cardName(slot),
                      path: [...setPath, "completed"],
                      label: "Done",
                    },
                  },
                ],
              },
              {
                id: `planned-${slot}`,
                component: "condition",
                props: {
                  when: {
                    op: "greater",
                    left: {
                      op: "length",
                      value: safe(
                        loggingValue(
                          slot,
                          "sets",
                          { itemIndex: "set" },
                          "targets",
                        ),
                        literal([]),
                      ),
                    },
                    right: literal(0),
                  },
                },
                then: {
                  id: `planned-row-${slot}`,
                  component: "row",
                  props: { gap: "small", align: "center", wrap: true },
                  children: [
                    text(`plan-label-${slot}`, valuesLabel(slot)),
                    copyButton(slot),
                  ],
                },
              },
              comparison(slot),
            ],
          },
        },
        {
          id: `card-actions-${slot}`,
          component: "row",
          props: { gap: "small", wrap: true },
          children: [
            {
              ...button(
                `add-set-${slot}`,
                "Add set",
                [
                  ...submitCards,
                  {
                    op: "invoke",
                    action: "add-workout-set",
                    input: object({
                      occurrenceId: safe(
                        loggingValue(slot, "exercise", "id"),
                        ref("params", ["id"]),
                      ),
                    }),
                    onSuccess: [{ op: "refresh-source", source: "screen" }],
                    onFailure: [],
                  },
                ],
                "secondary",
                {
                  op: "not",
                  value: {
                    op: "less",
                    left: {
                      op: "length",
                      value: loggingValue(slot, "records"),
                    },
                    right: literal(10),
                  },
                },
              ),
              visible: {
                op: "equal",
                left: ref("source", ["workout", "data", "status"], "screen"),
                right: literal("active"),
              },
            },
            button(
              `previous-${slot}`,
              "Previous values",
              [{ op: "refresh-source", source: compareName(slot) }],
              "ghost",
            ),
            button(
              `details-${slot}`,
              "Details",
              [
                ...submitCards,
                ...navigate(
                  "workout-exercise",
                  object({
                    id: safe(
                      loggingValue(slot, "exercise", "id"),
                      ref("params", ["id"]),
                    ),
                  }),
                ),
              ],
              "ghost",
            ),
          ],
        },
      ],
    },
  };
}

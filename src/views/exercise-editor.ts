import { defineView } from "@anvil/app-sdk/author";
import { authoredMetric, defaultMetrics } from "../metric-schema.mjs";
import {
  button,
  checkbox,
  empty,
  field,
  grid,
  heading,
  literal,
  navigate,
  object,
  ref,
  select,
  type Binding,
} from "./helpers.js";
import { measurementEditor } from "./measurements.js";
import { muscleEditor } from "./muscles.js";

function metricValues(keys: (keyof typeof defaultMetrics)[]) {
  return keys.map((key) => {
    const { version: _version, ...metric } = defaultMetrics[key];
    return metric;
  });
}
function initial(editing: boolean): Binding {
  if (!editing)
    return literal({
      value: {
        category: "strength",
        equipment: "",
        muscles: { primary: [], secondary: [] },
        metrics: metricValues(["repetitions", "load"]),
        instructions: "",
        archived: false,
      },
    });
  const value = object(
    Object.fromEntries(
      [
        "name",
        "category",
        "equipment",
        "muscles",
        "metrics",
        "instructions",
        "archived",
      ].map((key) => [
        key,
        key === "metrics"
          ? {
              op: "map",
              source: ref("source", ["data", "metrics"], "exercise"),
              as: "definition",
              maxItems: 12,
              value: object(
                Object.fromEntries(
                  Object.keys(authoredMetric.properties).map((field) => [
                    field,
                    ref("item", [field], "definition"),
                  ]),
                ),
              ),
            }
          : ref("source", ["data", key], "exercise"),
      ]),
    ),
  );
  return object({
    id: ref("source", ["id"], "exercise"),
    revision: ref("source", ["revision"], "exercise"),
    value,
  });
}

export function exerciseEditor(editing: boolean) {
  return defineView({
    id: editing ? "exercise" : "new-exercise",
    label: editing ? "Exercise" : "New exercise",
    surface: "app",
    paramsSchema: editing
      ? {
          ...empty,
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } },
          required: ["id"],
        }
      : empty,
    state: {
      schema: {
        ...empty,
        properties: {
          measurementOptions: { type: "boolean" },
          muscleOptions: { type: "boolean" },
        },
        required: ["measurementOptions", "muscleOptions"],
      },
      initial: { measurementOptions: false, muscleOptions: false },
    },
    sources: editing
      ? [
          {
            id: "exercise",
            action: "get-exercise",
            input: object({ id: ref("params", ["id"]) }),
            refresh: "open",
          },
        ]
      : [],
    actions: [
      editing ? "update-exercise" : "create-exercise",
      "new-measurement",
      ...(editing ? ["get-exercise"] : []),
    ],
    forms: [
      {
        id: "exercise",
        action: editing ? "update-exercise" : "create-exercise",
        initial: initial(editing),
        commit: editing ? "autosave" : "explicit",
        onSuccess: editing
          ? [
              {
                op: "set-form",
                form: "exercise",
                path: ["revision"],
                value: ref("event", ["revision"]),
              },
            ]
          : [
              {
                op: "navigate",
                view: "exercise",
                params: object({ id: ref("event", ["id"]) }),
              },
            ],
      },
    ],
    dialogs: [],
    root: {
      id: "exercise-page",
      component: "page",
      props: { gap: "large" },
      children: [
        button(
          "back-to-library",
          "Exercise library",
          navigate("exercises"),
          "ghost",
        ),
        heading("editor-title", editing ? "Exercise" : "New exercise", 1),
        grid("exercise-fields", [
          field("exercise-name", "Name", ["value", "name"]),
          select(
            "exercise-category",
            "Type",
            ["value", "category"],
            [
              { value: "strength", label: "Strength" },
              { value: "cardio", label: "Cardio" },
              { value: "custom", label: "Custom" },
            ],
          ),
          field("exercise-equipment", "Equipment", ["value", "equipment"]),
        ]),
        measurementEditor,
        muscleEditor,
        field(
          "exercise-instructions",
          "Notes and instructions",
          ["value", "instructions"],
          true,
        ),
        ...(editing
          ? [
              checkbox("exercise-archived", "Archive exercise", [
                "value",
                "archived",
              ]),
            ]
          : [
              button(
                "create-exercise",
                "Create exercise",
                [
                  {
                    op: "submit-form",
                    form: "exercise",
                    onSuccess: [],
                    onFailure: [],
                  },
                ],
                "primary",
              ),
            ]),
      ],
    },
  });
}

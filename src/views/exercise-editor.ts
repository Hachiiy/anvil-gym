import { defineView } from "@anvil/app-sdk/author";
import { defaultMetrics } from "../metric-schema.mjs";
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
  stack,
  text,
  type Binding,
} from "./helpers.js";
import { measurementEditor } from "./measurements.js";

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
      ["name", "equipment", "instructions", "archived"].map((key) => [
        key,
        ref("source", ["data", key], "exercise"),
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
        properties: { measurementOptions: { type: "boolean" } },
        required: ["measurementOptions"],
      },
      initial: { measurementOptions: false },
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
      editing ? "edit-exercise-details" : "create-exercise",
      "new-measurement",
      ...(editing ? ["get-exercise"] : []),
    ],
    forms: [
      {
        id: "exercise",
        action: editing ? "edit-exercise-details" : "create-exercise",
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
        text(
          "editor-help",
          editing
            ? "Changes save automatically. Workout history keeps its original measurements."
            : "Create any exercise and choose what you want to measure.",
        ),
        grid("exercise-fields", [
          field("exercise-name", "Name", ["value", "name"]),
          ...(editing
            ? []
            : [
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
              ]),
          field("exercise-equipment", "Equipment", ["value", "equipment"]),
        ]),
        ...(editing
          ? [
              heading("saved-measurements", "Measurements"),
              {
                id: "saved-measurement-list",
                component: "list" as const,
                props: {
                  items: ref("source", ["data", "metrics"], "exercise"),
                  as: "measurement",
                  key: ["key"],
                  maxItems: 12,
                },
                template: stack("saved-measurement", [
                  text(
                    "saved-measurement-label",
                    ref("item", ["label"], "measurement"),
                  ),
                  text(
                    "saved-measurement-unit",
                    ref("item", ["unit"], "measurement"),
                  ),
                ]),
              },
            ]
          : [measurementEditor]),
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

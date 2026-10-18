import type {
  AppJsonSchema,
  NativeNode,
  NativeViewDefinition,
} from "@anvil/app-sdk/author";
import { button, literal, object, ref, text, type Binding } from "./helpers.js";

type Filter = {
  key: string;
  label: string;
  initial: string | boolean;
  options?: { label: string; value: string }[];
};
const schemaObject = (
  properties: Record<string, AppJsonSchema>,
  required = Object.keys(properties),
): AppJsonSchema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const cursor: AppJsonSchema = { type: "string", maxLength: 65536 };
const pageInput = schemaObject({ cursor });
export const libraryValue = (key: string): Binding =>
  key === "nextCursor"
    ? {
        op: "coalesce",
        left: ref("source", [key], "library"),
        right: literal(""),
      }
    : ref("source", [key], "library");
export const libraryItems: Binding = {
  op: "coalesce",
  left: libraryValue("records"),
  right: literal([]),
};
const status = ref("source-status", [], "library");
const stackLength: Binding = {
  op: "length",
  value: ref("state", ["previous"]),
};
const lastPosition: Binding = {
  op: "subtract",
  left: stackLength,
  right: literal(1),
};
type LocalEvent = NonNullable<
  NativeViewDefinition["forms"][number]["onSuccess"]
>[number];
const reset: LocalEvent[] = [
  { op: "set-state", path: ["pageInput"], value: literal({ cursor: "" }) },
  { op: "set-state", path: ["previous"], value: literal([]) },
  { op: "set-state", path: ["page"], value: literal(1) },
];
export const filterButton = button(
  "library-filters",
  "Filters",
  [{ op: "open-dialog", dialog: "library-filters" }],
  "ghost",
);
export function libraryPaging(
  firstAction: string,
  nextAction: string,
  filters: Filter[],
) {
  const properties = Object.fromEntries(
    filters.map((filter) => [
      filter.key,
      typeof filter.initial === "boolean"
        ? ({ type: "boolean" } as const)
        : ({
            type: "string",
            maxLength: 100,
            enum: filter.options!.map((option) => option.value),
          } as const),
    ]),
  );
  const defaults = Object.fromEntries(
    filters.map((filter) => [filter.key, filter.initial]),
  );
  const state: NativeViewDefinition["state"] = {
    schema: schemaObject({
      query: schemaObject(properties),
      pageInput,
      previous: {
        type: "array",
        maxItems: 100,
        items: schemaObject({
          input: pageInput,
          position: { type: "integer", minimum: 0 },
        }),
      },
      page: { type: "integer" },
    }),
    initial: {
      query: defaults,
      pageInput: { cursor: "" },
      previous: [],
      page: 1,
    },
  };
  const forms: NativeViewDefinition["forms"] = [
    {
      id: "filters",
      action: `browse-${firstAction === "list-exercises" ? "exercise-library" : firstAction === "list-routines" ? "routine-library" : "workout-history"}`,
      commit: "explicit",
      initial: object({
        ...Object.fromEntries(
          filters.map((filter) => [
            filter.key,
            ref("state", ["query", filter.key]),
          ]),
        ),
        cursor: literal(""),
      }),
      onSuccess: [
        {
          op: "set-state",
          path: ["query"],
          value: object(
            Object.fromEntries(
              filters.map((filter) => [
                filter.key,
                {
                  op: "coalesce",
                  left: ref("form", [filter.key], "filters"),
                  right: literal(filter.initial),
                },
              ]),
            ),
          ),
        },
        ...reset,
        { op: "close-dialog", dialog: "library-filters" },
      ],
    },
  ];
  const dialogs: NativeViewDefinition["dialogs"] = [
    {
      id: "library-filters",
      label: "Filters",
      root: {
        id: "library-filter-fields",
        component: "stack",
        props: { gap: "normal" },
        children: [
          ...filters.map((filter): NativeNode =>
            filter.options
              ? {
                  id: `filter-${filter.key}`,
                  component: "select",
                  props: {
                    label: filter.label,
                    form: "filters",
                    path: [filter.key],
                    options: filter.options,
                  },
                }
              : {
                  id: `filter-${filter.key}`,
                  component: "checkbox",
                  props: {
                    label: filter.label,
                    form: "filters",
                    path: [filter.key],
                  },
                },
          ),
          {
            id: "filter-actions",
            component: "row",
            props: { gap: "small", wrap: true },
            children: [
              button(
                "apply-library-filters",
                "Apply",
                [
                  {
                    op: "submit-form",
                    form: "filters",
                    onSuccess: [],
                    onFailure: [],
                  },
                ],
                "primary",
              ),
              button(
                "reset-library-filters",
                "Reset",
                filters.map((filter) => ({
                  op: "set-form",
                  form: "filters",
                  path: [filter.key],
                  value: literal(filter.initial),
                })),
                "ghost",
              ),
            ],
          },
        ],
      },
    },
  ];
  const sources: NativeViewDefinition["sources"] = [
    {
      id: "library",
      action: `browse-${firstAction === "list-exercises" ? "exercise-library" : firstAction === "list-routines" ? "routine-library" : "workout-history"}`,
      input: object({
        ...Object.fromEntries(
          filters.map((filter) => [
            filter.key,
            ref("state", ["query", filter.key]),
          ]),
        ),
        cursor: ref("state", ["pageInput", "cursor"]),
      }),
      refresh: "open",
    },
  ];
  return {
    state,
    forms,
    dialogs,
    sources,
    actions: [firstAction, nextAction, sources[0]!.action],
  };
}
export function libraryFeedback(emptyTitle: string): NativeNode[] {
  return [
    {
      id: "library-loading",
      component: "condition",
      props: { when: { op: "equal", left: status, right: literal("loading") } },
      then: {
        id: "library-loading-label",
        component: "loading",
        props: { label: "Loading…" },
      },
    },
    {
      id: "library-empty",
      component: "condition",
      props: {
        when: {
          op: "and",
          left: { op: "equal", left: status, right: literal("ready") },
          right: {
            op: "equal",
            left: { op: "length", value: libraryItems },
            right: literal(0),
          },
        },
      },
      then: {
        id: "library-empty-label",
        component: "empty-state",
        props: { title: emptyTitle },
      },
    },
  ];
}
export const libraryPageControls = (id: string): NativeNode => ({
  id: `${id}-library-pages`,
  component: "row",
  props: { gap: "small", wrap: true },
  children: [
    {
      id: `${id}-previous-page`,
      component: "list",
      props: {
        items: {
          op: "filter",
          source: ref("state", ["previous"]),
          as: "candidate-page",
          maxItems: 100,
          value: {
            op: "equal",
            left: ref("item", ["position"], "candidate-page"),
            right: lastPosition,
          },
        },
        as: `${id}-previous-page`,
        key: ["position"],
        maxItems: 1,
      },
      template: button(`${id}-previous-library-page`, "Previous", [
        {
          op: "set-state",
          path: ["pageInput"],
          value: ref("item", ["input"], `${id}-previous-page`),
        },
        {
          op: "set-state",
          path: ["previous"],
          value: {
            op: "remove-at",
            source: ref("state", ["previous"]),
            index: lastPosition,
            maxItems: 100,
          },
        },
        {
          op: "set-state",
          path: ["page"],
          value: {
            op: "subtract",
            left: ref("state", ["page"]),
            right: literal(1),
          },
        },
        { op: "refresh-source", source: "library" },
      ]),
    },
    {
      ...text(`${id}-library-page-number`, {
        op: "concat",
        left: literal("Page "),
        right: {
          op: "format",
          format: "number",
          digits: 0,
          value: ref("state", ["page"]),
        },
      }),
      visible: {
        op: "greater",
        left: ref("state", ["page"]),
        right: literal(1),
      },
    },
    {
      ...button(`${id}-next-library-page`, "Next", [
        {
          op: "set-state",
          path: ["previous"],
          value: {
            op: "append",
            source: ref("state", ["previous"]),
            value: object({
              input: ref("state", ["pageInput"]),
              position: stackLength,
            }),
            maxItems: 100,
          },
        },
        {
          op: "set-state",
          path: ["pageInput"],
          value: object({ cursor: libraryValue("nextCursor") }),
        },
        {
          op: "set-state",
          path: ["page"],
          value: { op: "add", left: ref("state", ["page"]), right: literal(1) },
        },
        { op: "refresh-source", source: "library" },
      ]),
      visible: {
        op: "not",
        value: {
          op: "equal",
          left: libraryValue("nextCursor"),
          right: literal(""),
        },
      },
    },
    {
      ...button(
        `${id}-first-library-page`,
        "First",
        [...reset, { op: "refresh-source", source: "library" }],
        "ghost",
      ),
      visible: {
        op: "greater",
        left: ref("state", ["page"]),
        right: literal(1),
      },
    },
  ],
});
export const historyPaging = libraryPaging(
  "list-workout-history",
  "next-workout-history",
  [
    {
      key: "status",
      label: "Status",
      initial: "all",
      options: [
        { label: "All", value: "all" },
        { label: "Completed", value: "completed" },
        { label: "Abandoned", value: "abandoned" },
      ],
    },
  ],
);
export const exercisePaging = libraryPaging(
  "list-exercises",
  "next-exercises",
  [
    {
      key: "category",
      label: "Type",
      initial: "all",
      options: [
        { label: "All", value: "all" },
        { label: "Strength", value: "strength" },
        { label: "Cardio", value: "cardio" },
        { label: "Custom", value: "custom" },
      ],
    },
    { key: "archived", label: "Archived", initial: false },
  ],
);
export const routinePaging = libraryPaging("list-routines", "next-routines", [
  { key: "archived", label: "Archived", initial: false },
]);

export function libraryFilterBadges(
  ...keys: ("status" | "category" | "archived")[]
): NativeNode[] {
  return keys.map((key) => {
    const value = ref("state", ["query", key]);
    const names: Record<string, string> = {
      completed: "Completed",
      abandoned: "Abandoned",
      strength: "Strength",
      cardio: "Cardio",
      custom: "Custom",
    };
    return {
      id: `applied-${key}`,
      component: "badge",
      visible:
        key === "archived"
          ? value
          : {
              op: "not",
              value: { op: "equal", left: value, right: literal("all") },
            },
      props: {
        text:
          key === "archived"
            ? "Archived"
            : Object.entries(names).reduce<Binding>(
                (fallback, [match, label]) => ({
                  op: "if",
                  condition: {
                    op: "equal",
                    left: value,
                    right: literal(match),
                  },
                  then: literal(label),
                  else: fallback,
                }),
                literal(""),
              ),
      },
    };
  });
}

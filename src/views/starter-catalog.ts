import type { NativeEvent } from "@anvil/app-sdk/author";
import {
  button,
  heading,
  literal,
  navigate,
  object,
  ref,
  text,
} from "./helpers.js";
import { page, source, workoutView } from "./workout-helpers.js";

const copiesReady = {
  op: "equal" as const,
  left: ref("source-status", [], "copies"),
  right: literal("ready"),
};
const added = {
  op: "greater" as const,
  left: {
    op: "length" as const,
    value: {
      op: "filter" as const,
      source: {
        op: "coalesce" as const,
        left: ref("source", ["records"], "copies"),
        right: literal([]),
      },
      as: "selection",
      maxItems: 19,
      value: {
        op: "equal" as const,
        left: ref("item", ["data", "sourceId"], "selection"),
        right: ref("item", ["sourceId"], "entry"),
      },
    },
  },
  right: literal(0),
};

const openCopy: NativeEvent[] = [
  {
    op: "invoke",
    action: "add-starter-exercise",
    input: object({ sourceId: ref("item", ["sourceId"], "entry") }),
    onSuccess: [
      {
        op: "navigate",
        view: "exercise",
        params: object({ id: ref("event", ["id"]) }),
      },
    ],
    onFailure: [],
  },
];

export const starterCatalog = workoutView({
  id: "starter-catalog",
  label: "Starter exercises",
  actions: [
    "list-starter-exercises",
    "list-starter-copies",
    "add-starter-exercise",
  ],
  sources: [
    source("catalog", "list-starter-exercises", literal({})),
    source("copies", "list-starter-copies", literal({})),
  ],
  forms: [],
  root: page("catalog-page", [
    button("library", "Exercise library", navigate("exercises"), "ghost"),
    heading("catalog-title", "Starter exercises", 1),
    text(
      "catalog-credit",
      "free-exercise-db · Unlicense",
    ),
    {
      id: "copy-status-error",
      component: "condition",
      props: {
        when: {
          op: "equal",
          left: ref("source-status", [], "copies"),
          right: literal("error"),
        },
      },
      then: {
        id: "copies-read-error",
        component: "error",
        props: { message: "Your added exercises could not be checked." },
        onRetry: [{ op: "refresh-source", source: "copies" }],
      },
    },
    {
      id: "catalog-error",
      component: "condition",
      props: {
        when: {
          op: "equal",
          left: ref("source-status", [], "catalog"),
          right: literal("error"),
        },
      },
      then: {
        id: "catalog-read-error",
        component: "error",
        props: { message: "The starter catalog could not be loaded." },
        onRetry: [{ op: "refresh-source", source: "catalog" }],
      },
    },
    {
      id: "catalog-loading",
      component: "condition",
      props: {
        when: {
          op: "equal",
          left: ref("source-status", [], "catalog"),
          right: literal("loading"),
        },
      },
      then: {
        id: "loading-catalog",
        component: "loading",
        props: { label: "Loading starter exercises…" },
      },
    },
    {
      id: "catalog-entries",
      component: "list",
      props: {
        items: ref("source", ["records"], "catalog"),
        as: "entry",
        key: ["sourceId"],
        maxItems: 19,
      },
      template: {
        id: "catalog-entry",
        component: "card",
        props: { gap: "small" },
        children: [
          {
            id: "entry-name",
            component: "heading",
            props: { text: ref("item", ["value", "name"], "entry"), level: 2 },
          },
          text("entry-equipment", ref("item", ["value", "equipment"], "entry")),
          {
            ...text("entry-unmapped", ref("item", ["unmapped"], "entry")),
            visible: {
              op: "not",
              value: {
                op: "equal",
                left: ref("item", ["unmapped"], "entry"),
                right: literal(""),
              },
            },
          },
          {
            id: "entry-controls",
            component: "condition",
            props: { when: copiesReady },
            then: {
              id: "entry-copy-state",
              component: "condition",
              props: { when: added },
              then: {
                id: "added-entry-controls",
                component: "stack",
                props: { gap: "small" },
                children: [
                  {
                    id: "entry-added",
                    component: "badge",
                    props: { text: "Added" },
                  },
                  button("open-entry", "Open exercise", openCopy),
                ],
              },
              else: button("add-entry", "Add to exercises", openCopy),
            },
            else: button(
              "checking-entry",
              "Checking exercises…",
              [],
              "secondary",
              true,
            ),
          },
        ],
      },
    },
  ]),
});

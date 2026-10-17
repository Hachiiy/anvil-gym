import { defineView } from "@anvil/app-sdk/author";
import {
  button,
  empty,
  heading,
  literal,
  navigate,
  object,
  ref,
  stack,
  text,
} from "./helpers.js";

export const exerciseLibrary = defineView({
  id: "exercises",
  label: "Exercises",
  surface: "app",
  paramsSchema: empty,
  state: { schema: empty, initial: {} },
  forms: [],
  dialogs: [],
  actions: ["list-exercises"],
  sources: [
    {
      id: "exercises",
      action: "list-exercises",
      input: literal({ archived: false }),
      refresh: "open",
    },
  ],
  root: {
    id: "exercise-library",
    component: "page",
    props: { gap: "large" },
    children: [
      heading("library-title", "Exercises", 1),
      button("workouts", "Workouts", navigate("workouts"), "ghost"),
      button(
        "new-exercise",
        "New exercise",
        navigate("new-exercise"),
        "primary",
      ),
      button(
        "starter-exercises",
        "Browse starter exercises",
        navigate("starter-catalog"),
      ),
      {
        id: "library-loading",
        component: "condition",
        props: {
          when: {
            op: "equal",
            left: ref("source-status", [], "exercises"),
            right: literal("loading"),
          },
        },
        then: {
          id: "loading-exercises",
          component: "loading",
          props: { label: "Loading exercises…" },
        },
      },
      {
        id: "library-error",
        component: "condition",
        props: {
          when: {
            op: "equal",
            left: ref("source-status", [], "exercises"),
            right: literal("error"),
          },
        },
        then: {
          id: "exercise-read-error",
          component: "error",
          props: { message: "Exercises could not be loaded." },
          onRetry: [{ op: "refresh-source", source: "exercises" }],
        },
      },
      {
        id: "ready-library",
        component: "condition",
        props: {
          when: {
            op: "present",
            value: ref("source", ["records"], "exercises"),
          },
        },
        then: stack("exercise-results", [
          {
            id: "empty-library",
            component: "condition",
            props: {
              when: {
                op: "equal",
                left: {
                  op: "length",
                  value: ref("source", ["records"], "exercises"),
                },
                right: literal(0),
              },
            },
            then: {
              id: "no-exercises",
              component: "empty-state",
              props: {
                title: "No exercises yet",
                description:
                  "Create one or browse starter exercises.",
              },
            },
          },
          {
            id: "exercise-list",
            component: "list",
            props: {
              items: ref("source", ["records"], "exercises"),
              as: "exercise",
              key: ["id"],
              maxItems: 50,
            },
            template: {
              id: "exercise-card",
              component: "card",
              props: { gap: "small" },
              children: [
                {
                  id: "exercise-title",
                  component: "heading",
                  props: {
                    text: ref("item", ["data", "name"], "exercise"),
                    level: 2,
                  },
                },
                {
                  id: "exercise-type",
                  component: "badge",
                  props: {
                    text: ref("item", ["data", "category"], "exercise"),
                  },
                },
                text(
                  "exercise-equipment",
                  ref("item", ["data", "equipment"], "exercise"),
                ),
                button(
                  "open-exercise",
                  "Open exercise",
                  navigate(
                    "exercise",
                    object({ id: ref("item", ["id"], "exercise") }),
                  ),
                ),
              ],
            },
          },
        ]),
      },
    ],
  },
});

import type { NativeNode } from "@anvil/app-sdk/author";
import {
  button,
  heading,
  literal,
  navigate,
  object,
  ref,
  type Binding,
} from "./helpers.js";
import { page, source, workoutView } from "./workout-helpers.js";

const active: Binding = {
  op: "coalesce",
  left: ref("source", ["records"], "active"),
  right: literal([]),
};
const recent: Binding = {
  op: "filter",
  source: {
    op: "coalesce",
    left: ref("source", ["records"], "recent"),
    right: literal([]),
  },
  as: "candidate",
  maxItems: 50,
  value: {
    op: "not",
    value: {
      op: "equal",
      left: ref("item", ["data", "status"], "candidate"),
      right: literal("active"),
    },
  },
};
const list = (id: string, items: Binding, ongoing: boolean): NativeNode => ({
  id,
  component: "list",
  props: { items, as: "workout", key: ["id"], maxItems: 50 },
  template: {
    id: `${id}-card`,
    component: "card",
    props: { gap: "small" },
    children: [
      {
        id: `${id}-name`,
        component: "heading",
        props: { text: ref("item", ["data", "title"], "workout"), level: 2 },
      },
      {
        id: `${id}-date`,
        component: "text",
        props: {
          tone: "muted",
          text: {
            op: "format",
            format: "date",
            value: ref("item", ["data", "startedAt"], "workout"),
          },
        },
      },
      ...(!ongoing
        ? [
            {
              id: `${id}-status`,
              component: "badge" as const,
              props: { text: ref("item", ["data", "status"], "workout") },
            },
          ]
        : []),
      button(
        `${id}-open`,
        ongoing ? "Continue" : "Open workout",
        navigate("workout", object({ id: ref("item", ["id"], "workout") })),
        ongoing ? "primary" : "secondary",
      ),
    ],
  },
});
export const workouts = workoutView({
  id: "workouts",
  label: "Workouts",
  forms: [],
  actions: ["list-active-workouts", "list-workouts"],
  sources: [
    source("active", "list-active-workouts", literal({})),
    source("recent", "list-workouts", literal({})),
  ],
  root: page("workouts", [
    heading("workouts-heading", "Workouts", 1),
    {
      id: "workout-navigation",
      component: "row",
      props: { gap: "small", wrap: true },
      children: [
        {
          id: "start-choice",
          component: "condition",
          props: {
            when: {
              op: "greater",
              left: { op: "length", value: active },
              right: literal(0),
            },
          },
          then: button(
            "start-another",
            "New workout",
            navigate("start-workout"),
          ),
          else: button(
            "start-workout",
            "Start workout",
            navigate("start-workout"),
            "primary",
          ),
        },
        button("routines", "Routines", navigate("routines")),
        button("exercise-library", "Exercises", navigate("exercises")),
      ],
    },
    list("active-workouts", active, true),
    heading("recent-heading", "History", 2),
    list("recent-workouts", recent, false),
  ]),
});

import type { NativeNode } from "@anvil/app-sdk/author";
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

const openWorkout = [
  {
    op: "navigate" as const,
    view: "workout",
    params: object({ id: ref("event", ["id"]) }),
  },
];
const startWorkoutButton = button(
  "start-workout",
  "Start workout",
  [
    {
      op: "invoke",
      action: "start-workout",
      input: object({
        title: literal("Workout"),
        timeZone: ref("host", ["timeZone"]),
      }),
      onSuccess: openWorkout,
      onFailure: [],
    },
  ],
  "primary",
);

export const workouts = workoutView({
  id: "workouts",
  label: "Train",
  sources: [source("home", "get-training-home", literal({}))],
  actions: ["get-training-home", "start-workout", "start-routine-workout"],
  forms: [],
  root: page("train", [
    heading("train-heading", "Train", 1),
    {
      id: "active-workouts",
      component: "list",
      props: {
        items: ref("source", ["active", "records"], "home"),
        as: "workout",
        key: ["id"],
        maxItems: 50,
      },
      template: {
        id: "active-card",
        component: "card",
        props: { gap: "small" },
        children: [
          {
            id: "active-title",
            component: "heading",
            props: {
              text: ref("item", ["data", "title"], "workout"),
              level: 2,
            },
          },
          button(
            "continue-workout",
            "Continue workout",
            navigate("workout", object({ id: ref("item", ["id"], "workout") })),
            "primary",
          ),
        ],
      },
    },
    {
      id: "start-choice",
      component: "condition",
      props: {
        when: {
          op: "greater",
          left: {
            op: "length",
            value: {
              op: "coalesce",
              left: ref("source", ["active", "records"], "home"),
              right: literal([]),
            },
          },
          right: literal(0),
        },
      },
      then: {
        ...startWorkoutButton,
        id: "start-another",
        props: { tone: "ghost", label: "Start workout" },
      },
      else: startWorkoutButton,
    },
    {
      id: "routine-choices",
      component: "condition",
      props: {
        when: {
          op: "greater",
          left: {
            op: "length",
            value: {
              op: "coalesce",
              left: ref("source", ["routines", "records"], "home"),
              right: literal([]),
            },
          },
          right: literal(0),
        },
      },
      then: {
        id: "routine-section",
        component: "stack",
        props: { gap: "normal" },
        children: [
          heading("routine-heading", "Your routines"),
          {
            id: "routine-list",
            component: "list",
            props: {
              items: ref("source", ["routines", "records"], "home"),
              as: "routine",
              key: ["id"],
              maxItems: 50,
            },
            template: {
              id: "routine-choice",
              component: "card",
              props: { gap: "small" },
              children: [
                {
                  id: "routine-name",
                  component: "heading",
                  props: {
                    text: ref("item", ["data", "name"], "routine"),
                    level: 3,
                  },
                },
                button(
                  "start-routine",
                  "Start",
                  [
                    {
                      op: "invoke",
                      action: "start-routine-workout",
                      input: object({
                        id: ref("item", ["id"], "routine"),
                        revision: ref("item", ["revision"], "routine"),
                        timeZone: ref("host", ["timeZone"]),
                      }),
                      onSuccess: openWorkout,
                      onFailure: [],
                    },
                  ],
                  "secondary",
                ),
              ],
            },
          },
        ],
      },
      else: {
        id: "no-routines",
        component: "stack",
        props: { gap: "small" },
        children: [
          text(
            "routine-hint",
            "Build a routine to reuse your exercises and sets.",
          ),
          button(
            "new-routine",
            "Create routine",
            navigate("new-routine"),
            "ghost",
          ),
        ],
      },
    } as NativeNode,
  ]),
});

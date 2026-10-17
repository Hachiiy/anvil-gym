import {
  button,
  heading,
  literal,
  navigate,
  object,
  ref,
  stack,
} from "./helpers.js";
import {
  entityLink,
  page,
  paramsId,
  setLabel,
  source,
  workoutView,
} from "./workout-helpers.js";

export const chooseExercise = workoutView({
  id: "choose-exercise",
  label: "Choose exercise",
  entity: true,
  forms: [],
  actions: ["list-exercises", "add-workout-exercise"],
  sources: [
    source("exercises", "list-exercises", literal({ archived: false })),
  ],
  root: page("choose-exercise", [
    button("back-workout", "Workout", navigate("workout", paramsId()), "ghost"),
    heading("choose-heading", "Add exercise", 1),
    button("exercise-library", "Exercise library", navigate("exercises")),
    {
      id: "exercise-picker",
      component: "list",
      props: {
        items: ref("source", ["records"], "exercises"),
        as: "exercise",
        key: ["id"],
        maxItems: 50,
      },
      template: {
        id: "exercise-choice",
        component: "card",
        props: { gap: "small" },
        children: [
          {
            id: "choice-name",
            component: "heading",
            props: {
              text: ref("item", ["data", "name"], "exercise"),
              level: 2,
            },
          },
          button(
            "add-chosen-exercise",
            "Add to workout",
            [
              {
                op: "invoke",
                action: "add-workout-exercise",
                input: object({
                  sessionId: ref("params", ["id"]),
                  exerciseId: ref("item", ["id"], "exercise"),
                }),
                onSuccess: [
                  {
                    op: "navigate",
                    view: "workout-exercise",
                    params: object({ id: ref("event", ["id"]) }),
                  },
                ],
                onFailure: [],
              },
            ],
            "primary",
          ),
        ],
      },
    },
  ]),
});

export const workoutExercise = workoutView({
  id: "workout-exercise",
  label: "Workout exercise",
  entity: true,
  forms: [],
  actions: ["get-workout-exercise", "list-workout-sets", "add-workout-set"],
  sources: [
    source("exercise", "get-workout-exercise", paramsId()),
    source(
      "sets",
      "list-workout-sets",
      object({ occurrenceId: ref("params", ["id"]) }),
    ),
  ],
  root: page("workout-exercise", [
    button(
      "back-workout",
      "Workout",
      navigate("workout", entityLink(["data", "sessionId"], "exercise")),
      "ghost",
    ),
    {
      id: "exercise-heading",
      component: "heading",
      props: {
        text: ref("source", ["data", "snapshot", "name"], "exercise"),
        level: 1,
      },
    },
    {
      id: "sets",
      component: "list",
      props: {
        items: ref("source", ["records"], "sets"),
        as: "set",
        key: ["id"],
        maxItems: 10,
      },
      template: {
        id: "set-card",
        component: "card",
        props: { gap: "small" },
        children: [
          {
            id: "set-heading",
            component: "heading",
            props: { text: setLabel(), level: 2 },
          },
          {
            id: "set-completed",
            component: "badge",
            props: {
              text: {
                op: "if",
                condition: ref("item", ["data", "completed"], "set"),
                then: literal("Completed"),
                else: literal("Not completed"),
              },
            },
          },
          {
            id: "set-metrics",
            component: "list",
            props: {
              items: ref("source", ["data", "snapshot", "metrics"], "exercise"),
              as: "metric",
              key: ["key"],
              maxItems: 12,
            },
            template: {
              id: "observations",
              component: "list",
              props: {
                items: {
                  op: "filter",
                  source: ref("item", ["data", "actual"], "set"),
                  as: "candidate",
                  value: {
                    op: "equal",
                    left: ref("item", ["key"], "candidate"),
                    right: ref("item", ["key"], "metric"),
                  },
                  maxItems: 12,
                },
                as: "observation",
                key: ["key"],
                maxItems: 1,
              },
              template: {
                id: "measurement-value",
                component: "statistic",
                props: {
                  label: ref("item", ["label"], "metric"),
                  value: ref("item", ["value"], "observation"),
                  unit: ref("item", ["unit"], "observation"),
                },
              },
            },
          },
          button(
            "edit-set",
            "Record set",
            navigate("workout-set", object({ id: ref("item", ["id"], "set") })),
          ),
        ],
      },
    },
    button("add-set", "Add set", [
      {
        op: "invoke",
        action: "add-workout-set",
        input: object({ occurrenceId: ref("params", ["id"]) }),
        onSuccess: [{ op: "refresh-source", source: "sets" }],
        onFailure: [],
      },
    ]),
  ]),
});

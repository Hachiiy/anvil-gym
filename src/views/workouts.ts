import {
  button,
  heading,
  literal,
  navigate,
  object,
  ref,
  stack,
  text,
} from "./helpers.js";
import {
  active,
  formField,
  page,
  revisionHook,
  source,
  workoutView,
} from "./workout-helpers.js";

export const workouts = workoutView({
  id: "workouts",
  label: "Workouts",
  forms: [],
  actions: ["list-workouts"],
  sources: [source("workouts", "list-workouts", literal({}))],
  root: page("workouts", [
    heading("workouts-heading", "Workouts", 1),
    text(
      "workouts-help",
      "Start a workout, record what you do and keep your history.",
    ),
    {
      id: "workout-navigation",
      component: "row",
      props: { gap: "small", wrap: true },
      children: [
        button(
          "start-workout",
          "Start workout",
          navigate("start-workout"),
          "primary",
        ),
        button("exercise-library", "Exercise library", navigate("exercises")),
      ],
    },
    {
      id: "workouts-ready",
      component: "condition",
      props: {
        when: { op: "present", value: ref("source", ["records"], "workouts") },
      },
      then: stack("workout-results", [
        {
          id: "no-workouts",
          component: "condition",
          props: {
            when: {
              op: "equal",
              left: {
                op: "length",
                value: ref("source", ["records"], "workouts"),
              },
              right: literal(0),
            },
          },
          then: {
            id: "workouts-empty",
            component: "empty-state",
            props: {
              title: "Your next workout starts here",
              description:
                "Free workouts can use any exercise and custom measurements.",
            },
          },
        },
        {
          id: "workout-list",
          component: "list",
          props: {
            items: ref("source", ["records"], "workouts"),
            as: "workout",
            key: ["id"],
            maxItems: 50,
          },
          template: {
            id: "workout-card",
            component: "card",
            props: { gap: "small" },
            children: [
              {
                id: "workout-title",
                component: "heading",
                props: {
                  text: ref("item", ["data", "title"], "workout"),
                  level: 2,
                },
              },
              text("workout-date", {
                op: "format",
                format: "date",
                value: ref("item", ["data", "startedAt"], "workout"),
              }),
              {
                id: "workout-status",
                component: "badge",
                props: { text: ref("item", ["data", "status"], "workout") },
              },
              button(
                "open-workout",
                "Open workout",
                navigate(
                  "workout",
                  object({ id: ref("item", ["id"], "workout") }),
                ),
              ),
            ],
          },
        },
      ]),
    },
  ]),
});

export const startWorkout = workoutView({
  id: "start-workout",
  label: "Start workout",
  sources: [],
  actions: ["start-workout"],
  forms: [
    {
      id: "workout",
      action: "start-workout",
      commit: "explicit",
      initial: object({
        title: literal("Workout"),
        timeZone: ref("host", ["timeZone"]),
      }),
      onSuccess: [
        {
          op: "navigate",
          view: "workout",
          params: object({ id: ref("event", ["id"]) }),
        },
      ],
    },
  ],
  root: page("start-workout", [
    button("back-workouts", "Workouts", navigate("workouts"), "ghost"),
    heading("start-heading", "Start workout", 1),
    text(
      "start-help",
      "Add exercises as you go. Planned and performed values stay separate.",
    ),
    formField("workout-title", "Title", "workout", ["title"]),
    button(
      "begin-workout",
      "Begin workout",
      [{ op: "submit-form", form: "workout", onSuccess: [], onFailure: [] }],
      "primary",
    ),
  ]),
});

export const workout = workoutView({
  id: "workout",
  label: "Workout",
  entity: true,
  actions: [
    "get-workout",
    "list-workout-exercises",
    "edit-workout",
    "finish-workout",
    "abandon-workout",
  ],
  sources: [
    source("workout", "get-workout", object({ id: ref("params", ["id"]) })),
    source(
      "exercises",
      "list-workout-exercises",
      object({ sessionId: ref("params", ["id"]) }),
    ),
  ],
  forms: [
    {
      id: "workout",
      action: "edit-workout",
      commit: "autosave",
      initial: object({
        id: ref("source", ["id"], "workout"),
        revision: ref("source", ["revision"], "workout"),
        title: ref("source", ["data", "title"], "workout"),
        notes: ref("source", ["data", "notes"], "workout"),
      }),
      onSuccess: revisionHook("workout"),
    },
  ],
  root: page("workout", [
    button("back-workouts", "Workouts", navigate("workouts"), "ghost"),
    heading("workout-heading", "Workout", 1),
    {
      id: "workout-status",
      component: "badge",
      props: { text: ref("source", ["data", "status"], "workout") },
    },
    formField("workout-title", "Title", "workout", ["title"]),
    {
      ...button(
        "add-exercise",
        "Add exercise",
        navigate("choose-exercise", object({ id: ref("params", ["id"]) })),
        "primary",
      ),
      visible: active,
    },
    {
      id: "workout-exercises",
      component: "list",
      props: {
        items: ref("source", ["records"], "exercises"),
        as: "exercise",
        key: ["id"],
        maxItems: 50,
      },
      template: {
        id: "occurrence",
        component: "card",
        props: { gap: "small" },
        children: [
          {
            id: "occurrence-title",
            component: "heading",
            props: {
              text: ref("item", ["data", "snapshot", "name"], "exercise"),
              level: 2,
            },
          },
          button(
            "record-exercise",
            "View sets",
            navigate(
              "workout-exercise",
              object({ id: ref("item", ["id"], "exercise") }),
            ),
          ),
        ],
      },
    },
    formField("workout-notes", "Workout notes", "workout", ["notes"], true),
    {
      ...button(
        "finish-workout",
        "Finish workout",
        [
          { op: "submit-form", form: "workout", onSuccess: [], onFailure: [] },
          {
            op: "invoke",
            action: "finish-workout",
            input: object({
              id: ref("source", ["id"], "workout"),
              revision: ref("source", ["revision"], "workout"),
            }),
            onSuccess: [{ op: "refresh-source", source: "workout" }],
            onFailure: [],
          },
        ],
        "primary",
      ),
      visible: active,
    },
  ]),
});

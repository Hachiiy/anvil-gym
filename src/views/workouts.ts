import {
  button,
  heading,
  literal,
  navigate,
  object,
  ref,
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
import { countLabel, join, groupLabel } from "./structure-labels.js";

export { workouts } from "./workout-library.js";

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
    "list-workout-outline",
    "edit-workout",
    "finish-workout",
    "abandon-workout",
    "start-history-workout",
  ],
  sources: [
    source("workout", "get-workout", object({ id: ref("params", ["id"]) })),
    source(
      "exercises",
      "list-workout-outline",
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
  dialogs: [
    {
      id: "workout-details",
      label: "Workout details",
      root: {
        id: "details-fields",
        component: "stack",
        props: { gap: "normal" },
        children: [
          formField("workout-title", "Title", "workout", ["title"]),
          formField("workout-notes", "Notes", "workout", ["notes"], true),
        ],
      },
    },
  ],
  root: page("workout", [
    button(
      "back-workouts",
      "Workouts",
      [
        { op: "submit-form", form: "workout", onSuccess: [], onFailure: [] },
        ...navigate("workouts"),
      ],
      "ghost",
    ),
    {
      id: "workout-heading",
      component: "heading",
      props: {
        text: {
          op: "coalesce",
          left: ref("form", ["title"], "workout"),
          right: literal("Workout"),
        },
        level: 1,
      },
    },
    {
      id: "workout-status",
      component: "badge",
      props: { text: ref("source", ["data", "status"], "workout") },
    },
    button(
      "workout-details",
      "Details",
      [{ op: "open-dialog", dialog: "workout-details" }],
      "ghost",
    ),
    {
      ...button(
        "repeat-workout",
        "Repeat workout",
        [
          { op: "submit-form", form: "workout", onSuccess: [], onFailure: [] },
          {
            op: "invoke",
            action: "start-history-workout",
            input: object({
              id: ref("source", ["id"], "workout"),
              revision: {
                op: "coalesce",
                left: ref("form", ["revision"], "workout"),
                right: ref("source", ["revision"], "workout"),
              },
              timeZone: ref("host", ["timeZone"]),
            }),
            onSuccess: [
              {
                op: "navigate",
                view: "workout",
                params: object({ id: ref("event", ["id"]) }),
              },
            ],
            onFailure: [],
          },
        ],
        "primary",
      ),
      visible: {
        op: "equal",
        left: ref("source", ["data", "status"], "workout"),
        right: literal("completed"),
      },
    },
    {
      ...button(
        "add-exercise",
        "Add exercise",
        [
          { op: "submit-form", form: "workout", onSuccess: [], onFailure: [] },
          ...navigate("choose-exercise", object({ id: ref("params", ["id"]) })),
        ],
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
              text: join(
                {
                  op: "format",
                  format: "number",
                  digits: 0,
                  value: {
                    op: "add",
                    left: ref("item", ["data", "position"], "exercise"),
                    right: literal(1),
                  },
                },
                ref("item", ["data", "snapshot", "name"], "exercise"),
                ". ",
              ),
              level: 2,
            },
          },
          text(
            "occurrence-structure",
            join(
              groupLabel(
                ref("item", ["kind"], "exercise"),
                ref("item", ["blockPosition"], "exercise"),
              ),
              join(
                countLabel(ref("item", ["rounds"], "exercise"), "round"),
                countLabel(ref("item", ["sets"], "exercise"), "set"),
              ),
            ),
          ),
          button("record-exercise", "Record sets", [
            {
              op: "submit-form",
              form: "workout",
              onSuccess: [],
              onFailure: [],
            },
            ...navigate(
              "workout-exercise",
              object({ id: ref("item", ["id"], "exercise") }),
            ),
          ]),
        ],
      },
    },
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
              revision: {
                op: "coalesce",
                left: ref("form", ["revision"], "workout"),
                right: ref("source", ["revision"], "workout"),
              },
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

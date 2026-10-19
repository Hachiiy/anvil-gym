import { removalConfirmation } from "./workout-tree-removal.js";
import { button, heading, literal, navigate, object, ref } from "./helpers.js";
import {
  formField,
  page,
  revisionHook,
  source,
  workoutView,
} from "./workout-helpers.js";

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
  id: "workout-details",
  label: "Workout details",
  entity: true,
  actions: ["get-workout", "edit-workout", "remove-workout"],
  sources: [
    source("workout", "get-workout", object({ id: ref("params", ["id"]) })),
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
    removalConfirmation(
      "remove-workout",
      "Remove workout?",
      "remove-workout",
      object({
        id: ref("source", ["id"], "workout"),
        revision: {
          op: "coalesce",
          left: ref("form", ["revision"], "workout"),
          right: ref("source", ["revision"], "workout"),
        },
      }),
      ref("source", ["data", "title"], "workout"),
      [{ op: "navigate", view: "workouts", params: literal({}) }],
    ),
  ],
  root: page("workout-details-page", [
    button(
      "back-workout",
      "Workout",
      [
        { op: "submit-form", form: "workout", onSuccess: [], onFailure: [] },
        ...navigate("workout", object({ id: ref("params", ["id"]) })),
      ],
      "ghost",
    ),
    heading("details-heading", "Workout details", 1),
    formField("workout-title", "Title", "workout", ["title"]),
    formField("workout-notes", "Notes", "workout", ["notes"], true),
    button("organize-workout", "Exercise order and groups", [
      { op: "submit-form", form: "workout", onSuccess: [], onFailure: [] },
      ...navigate("workout-structure", object({ id: ref("params", ["id"]) })),
    ]),
    button(
      "remove-workout",
      "Remove workout",
      [
        { op: "submit-form", form: "workout", onSuccess: [], onFailure: [] },
        { op: "open-dialog", dialog: "remove-workout" },
      ],
      "ghost",
    ),
  ]),
});

import {
  routinePaging,
  filterButton,
  libraryFilterBadges,
  libraryFeedback,
  libraryItems,
  libraryPageControls,
} from "./library-pages.js";
import { button, heading, literal, navigate, object, ref } from "./helpers.js";
import {
  formField,
  page,
  paramsId,
  revisionHook,
  source,
  workoutView,
} from "./workout-helpers.js";
import { blocksEditor, pickExercise, routineBlocks } from "./routine-blocks.js";
import { exercisePicker } from "./routine-picker.js";
import { blocksSummary } from "./routine-summary.js";

export const routineLibrary = workoutView({
  id: "routines",
  label: "Routines",
  ...routinePaging,
  root: page("routines", [
    button("back-workouts", "Workouts", navigate("workouts"), "ghost"),
    heading("routines-heading", "Routines", 1),
    {
      id: "routine-library-actions",
      component: "row",
      props: { gap: "small", wrap: true },
      children: [
        button(
          "new-routine",
          "New routine",
          navigate("new-routine"),
          "primary",
        ),
        filterButton,
        ...libraryFilterBadges("archived"),
      ],
    },
    libraryPageControls("top"),
    ...libraryFeedback("No routines"),
    {
      id: "routine-list",
      component: "list",
      props: {
        items: libraryItems,
        as: "routine",
        key: ["id"],
        maxItems: 50,
      },
      template: {
        id: "routine-card",
        component: "card",
        props: { gap: "small" },
        children: [
          {
            id: "routine-name",
            component: "heading",
            props: { text: ref("item", ["data", "name"], "routine"), level: 2 },
          },
          button(
            "open-routine",
            "Open routine",
            navigate("routine", object({ id: ref("item", ["id"], "routine") })),
          ),
        ],
      },
    },
    libraryPageControls("bottom"),
  ]),
});

export const newRoutine = workoutView({
  id: "new-routine",
  label: "New routine",
  sources: [],
  actions: ["create-routine"],
  forms: [
    {
      id: "routine",
      action: "create-routine",
      commit: "explicit",
      initial: literal({ name: "Routine" }),
      onSuccess: [
        {
          op: "navigate",
          view: "routine",
          params: object({ id: ref("event", ["id"]) }),
        },
      ],
    },
  ],
  root: page("new-routine", [
    button("back-routines", "Routines", navigate("routines"), "ghost"),
    heading("new-routine-heading", "New routine", 1),
    formField("new-routine-name", "Name", "routine", ["name"]),
    button(
      "create-routine",
      "Create routine",
      [{ op: "submit-form", form: "routine", onSuccess: [], onFailure: [] }],
      "primary",
    ),
  ]),
});

export const routineEditor = workoutView({
  id: "routine",
  label: "Routine",
  entity: true,
  actions: [
    "get-routine",
    "revise-routine",
    "list-exercises",
    "prepare-routine-block",
    "start-routine-workout",
  ],
  sources: [
    source("routine", "get-routine", paramsId()),
    source("exercises", "list-exercises", literal({ archived: false })),
  ],
  forms: [
    {
      id: "routine",
      action: "revise-routine",
      commit: "autosave",
      initial: object({
        id: ref("source", ["id"], "routine"),
        revision: ref("source", ["revision"], "routine"),
        value: ref("source", ["data"], "routine"),
      }),
      onSuccess: revisionHook("routine"),
    },
  ],
  dialogs: [
    {
      id: "exercise-picker",
      label: "Choose exercise",
      root: exercisePicker("routine"),
    },
  ],
  root: page("routine", [
    button(
      "back-routines",
      "Routines",
      [
        { op: "submit-form", form: "routine", onSuccess: [], onFailure: [] },
        ...navigate("routines"),
      ],
      "ghost",
    ),
    heading("routine-heading", "Routine", 1),
    formField("routine-name", "Name", "routine", ["value", "name"]),
    button(
      "start-routine-workout",
      "Start workout",
      [
        { op: "submit-form", form: "routine", onSuccess: [], onFailure: [] },
        {
          op: "invoke",
          action: "start-routine-workout",
          input: object({
            id: ref("params", ["id"]),
            revision: {
              op: "coalesce",
              left: ref("form", ["revision"], "routine"),
              right: ref("source", ["revision"], "routine"),
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
      {
        op: "equal",
        left: { op: "length", value: routineBlocks },
        right: literal(0),
      },
    ),
    blocksSummary,
    button("add-routine-block", "Add block", pickExercise(), "secondary", {
      op: "greater",
      left: { op: "length", value: routineBlocks },
      right: literal(29),
    }),
    formField("routine-notes", "Notes", "routine", ["value", "notes"], true),
    {
      id: "routine-archive",
      component: "checkbox",
      props: {
        label: "Archived",
        form: "routine",
        path: ["value", "archived"],
      },
    },
  ]),
});

export const routineBlockEditor = workoutView({
  id: "routine-block",
  label: "Routine block",
  paramsSchema: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 36, maxLength: 36 },
      blockKey: { type: "string", minLength: 36, maxLength: 36 },
    },
    required: ["id", "blockKey"],
    additionalProperties: false,
  },
  actions: [
    "get-routine-block",
    "revise-routine-block",
    "prepare-routine-block",
    "list-exercises",
  ],
  sources: [
    source(
      "block",
      "get-routine-block",
      object({
        id: ref("params", ["id"]),
        blockKey: ref("params", ["blockKey"]),
      }),
    ),
    source("exercises", "list-exercises", literal({ archived: false })),
  ],
  forms: [
    {
      id: "routine",
      action: "revise-routine-block",
      commit: "autosave",
      initial: ref("source", [], "block"),
      onSuccess: revisionHook("routine"),
    },
  ],
  dialogs: [
    {
      id: "exercise-picker",
      label: "Choose exercise",
      root: exercisePicker("block"),
    },
  ],
  root: page("routine-block-page", [
    button(
      "back-routine",
      "Routine",
      [
        { op: "submit-form", form: "routine", onSuccess: [], onFailure: [] },
        ...navigate("routine", paramsId()),
      ],
      "ghost",
    ),
    heading("block-heading", "Block", 1),
    blocksEditor,
  ]),
});

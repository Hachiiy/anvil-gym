import { button, literal, navigate, object, ref, text } from "./helpers.js";
import { page, source, workoutView } from "./workout-helpers.js";
import { overviewCard } from "./overview-card.js";
import {
  cardCount,
  cardName,
  compareName,
  loggingValue,
  safe,
  submitCards,
} from "./overview-helpers.js";
import { join } from "./structure-labels.js";

const indices = Array.from({ length: cardCount }, (_, slot) => slot);
const pageIndex = ref("state", ["page"]);
const entity = object({ id: ref("params", ["id"]) });
const navigateFromCards = (view: string, params = literal({})) => [
  ...submitCards,
  ...navigate(view, params),
];
const pageControl = (forward: boolean) =>
  button(
    forward ? "next-exercises" : "previous-exercises",
    forward ? "Next exercises" : "Previous exercises",
    [
      ...submitCards,
      {
        op: "set-state",
        path: ["page"],
        value: ref("source", [forward ? "nextPage" : "previousPage"], "page"),
      },
      { op: "refresh-source", source: "page" },
    ],
    "ghost",
    forward
      ? {
          op: "not",
          value: {
            op: "less",
            left: {
              op: "multiply",
              left: { op: "add", left: pageIndex, right: literal(1) },
              right: literal(cardCount),
            },
            right: ref("source", ["total"], "page"),
          },
        }
      : { op: "equal", left: pageIndex, right: literal(0) },
  );

export const workoutOverview = workoutView({
  id: "workout",
  label: "Workout",
  entity: true,
  state: {
    schema: {
      type: "object",
      properties: { page: { type: "integer", minimum: 0, maximum: 8 } },
      required: ["page"],
      additionalProperties: false,
    },
    initial: { page: 0 },
  },
  actions: [
    "get-workout",
    "get-workout-page",
    "get-workout-card",
    "get-workout-comparison",
    "record-workout-card",
    "add-workout-set",
    "finish-workout",
    "start-history-workout",
  ],
  sources: [
    source("workout", "get-workout", entity),
    source(
      "page",
      "get-workout-page",
      object({ sessionId: ref("params", ["id"]), page: pageIndex }),
    ),
    ...indices.flatMap((slot) => [
      source(
        cardName(slot),
        "get-workout-card",
        object({ ids: ref("source", ["slots", slot, "ids"], "page") }),
      ),
      source(
        compareName(slot),
        "get-workout-comparison",
        object({ ids: ref("source", ["slots", slot, "ids"], "page") }),
      ),
    ]),
  ],
  forms: indices.map((slot) => ({
    id: cardName(slot),
    action: "record-workout-card",
    commit: "autosave",
    initial: safe(
      object({
        occurrenceId: safe(
          loggingValue(slot, "exercise", "id"),
          ref("params", ["id"]),
        ),
        sets: {
          op: "map",
          source: loggingValue(slot, "sets"),
          as: "initial",
          maxItems: 10,
          value: ref("item", ["draft"], "initial"),
        },
      }),
      literal({ sets: [] }),
    ),
    onSuccess: [
      {
        op: "set-form",
        form: cardName(slot),
        path: ["sets"],
        value: ref("event", ["sets"]),
      },
    ],
  })),
  dialogs: [
    {
      id: "finish",
      label: "Finish workout?",
      root: page("finish-summary", [
        text(
          "finish-count",
          join(
            {
              op: "format",
              format: "number",
              digits: 0,
              value: ref("source", ["completed"], "page"),
            },
            literal("completed sets"),
            " ",
          ),
        ),
        text(
          "finish-help",
          "Unfinished sets stay uncompleted. Your routine stays unchanged.",
        ),
        button(
          "confirm-finish",
          "Finish workout",
          [
            {
              op: "invoke",
              action: "finish-workout",
              input: object({
                id: ref("params", ["id"]),
                revision: ref("source", ["revision"], "workout"),
              }),
              onSuccess: [
                { op: "close-dialog", dialog: "finish" },
                { op: "refresh-source", source: "workout" },
              ],
              onFailure: [],
            },
          ],
          "primary",
        ),
      ]),
    },
  ],
  root: page("workout-overview", [
    {
      id: "workout-navigation",
      component: "row",
      props: { gap: "small", wrap: true },
      children: [
        button(
          "all-workouts",
          "Workouts",
          navigateFromCards("workouts"),
          "ghost",
        ),
        button("library", "Library", navigateFromCards("routines"), "ghost"),
        button(
          "details",
          "Details",
          navigateFromCards("workout-details", entity),
          "ghost",
        ),
      ],
    },
    {
      id: "workout-title",
      component: "heading",
      props: { text: ref("source", ["data", "title"], "workout"), level: 1 },
    },
    text(
      "workout-progress",
      join(
        join(
          {
            op: "format",
            format: "number",
            digits: 0,
            value: ref("source", ["completed"], "page"),
          },
          {
            op: "format",
            format: "number",
            digits: 0,
            value: ref("source", ["sets"], "page"),
          },
          " / ",
        ),
        literal("sets complete"),
        " ",
      ),
    ),
    {
      ...button(
        "finish-workout",
        "Finish",
        [...submitCards, { op: "open-dialog", dialog: "finish" }],
        "primary",
      ),
      visible: {
        op: "equal",
        left: ref("source", ["data", "status"], "workout"),
        right: literal("active"),
      },
    },
    {
      ...button(
        "repeat-workout",
        "Repeat workout",
        [
          ...submitCards,
          {
            op: "invoke",
            action: "start-history-workout",
            input: object({
              id: ref("params", ["id"]),
              revision: ref("source", ["revision"], "workout"),
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
    ...indices.map(overviewCard),
    {
      ...button(
        "add-exercise",
        "Add exercise",
        navigateFromCards("choose-exercise", entity),
      ),
      visible: {
        op: "equal",
        left: ref("source", ["data", "status"], "workout"),
        right: literal("active"),
      },
    },
    {
      id: "exercise-pages",
      component: "condition",
      props: {
        when: {
          op: "greater",
          left: ref("source", ["total"], "page"),
          right: literal(cardCount),
        },
      },
      then: {
        id: "page-controls",
        component: "row",
        props: { gap: "small", wrap: true },
        children: [pageControl(false), pageControl(true)],
      },
    },
  ]),
});

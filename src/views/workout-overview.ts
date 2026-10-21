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
        value: ref(
          "source",
          ["page", forward ? "nextPage" : "previousPage"],
          "screen",
        ),
      },
      { op: "refresh-source", source: "screen" },
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
            right: ref("source", ["page", "total"], "screen"),
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
    "get-workout-screen",
    "get-workout-comparison",
    "record-workout-card",
    "add-workout-set",
    "finish-workout",
    "start-history-workout",
  ],
  sources: [
    source(
      "screen",
      "get-workout-screen",
      object({ sessionId: ref("params", ["id"]), page: pageIndex }),
    ),
    ...indices.map((slot) => ({
      ...source(
        compareName(slot),
        "get-workout-comparison",
        object({
          ids: ref("source", ["page", "slots", slot, "ids"], "screen"),
        }),
      ),
      refresh: "manual" as const,
    })),
  ],
  forms: indices.map((slot) => ({
    id: cardName(slot),
    action: "record-workout-card",
    commit: "autosave",
    refreshSources: ["screen"],
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
              value: ref("source", ["page", "completed"], "screen"),
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
                revision: ref("source", ["workout", "revision"], "screen"),
              }),
              onSuccess: [
                { op: "close-dialog", dialog: "finish" },
                { op: "refresh-source", source: "screen" },
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
      id: "workout-header",
      component: "row",
      props: { gap: "small", wrap: true, align: "center" },
      children: [
        {
          id: "workout-title",
          component: "heading",
          props: {
            text: ref("source", ["workout", "data", "title"], "screen"),
            level: 1,
          },
        },
        button(
          "details",
          "Details",
          navigateFromCards("workout-details", entity),
          "ghost",
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
            left: ref("source", ["workout", "data", "status"], "screen"),
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
                  revision: ref("source", ["workout", "revision"], "screen"),
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
            left: ref("source", ["workout", "data", "status"], "screen"),
            right: literal("completed"),
          },
        },
      ],
    },
    text(
      "workout-progress",
      join(
        join(
          {
            op: "format",
            format: "number",
            digits: 0,
            value: ref("source", ["page", "completed"], "screen"),
          },
          {
            op: "format",
            format: "number",
            digits: 0,
            value: ref("source", ["page", "sets"], "screen"),
          },
          " / ",
        ),
        literal("sets complete"),
        " ",
      ),
    ),
    ...indices.map(overviewCard),
    {
      ...button(
        "add-exercise",
        "Add exercise",
        navigateFromCards("choose-exercise", entity),
      ),
      visible: {
        op: "equal",
        left: ref("source", ["workout", "data", "status"], "screen"),
        right: literal("active"),
      },
    },
    {
      id: "workout-navigation",
      component: "row",
      props: { gap: "small", wrap: true },
      children: [
        button("all-workouts", "Train", navigateFromCards("workouts"), "ghost"),
      ],
    },
    {
      id: "exercise-pages",
      component: "condition",
      props: {
        when: {
          op: "greater",
          left: ref("source", ["page", "total"], "screen"),
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

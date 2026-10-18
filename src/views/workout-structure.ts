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
import { paramsId, source, workoutView } from "./workout-helpers.js";
import { countLabel, groupLabel, join } from "./structure-labels.js";
import {
  recoveryActions,
  recoveryControls,
  removalConfirmation,
} from "./workout-tree-removal.js";

const refresh = [
  { op: "refresh-source" as const, source: "structure" },
  { op: "refresh-source" as const, source: "removals" },
];
const occurrenceLabel = join(
  {
    op: "format",
    format: "number",
    digits: 0,
    value: ref(
      "source",
      ["ordinals", { itemIndex: "occurrence" }],
      "structure",
    ),
  },
  ref("item", ["data", "snapshot", "name"], "occurrence"),
  ". ",
);
const remove = (scope: "block" | "occurrence"): NativeNode =>
  button(
    `remove-${scope}`,
    scope === "block" ? "Remove group" : "Remove exercise",
    [
      { op: "set-state", path: ["id"], value: ref("item", ["id"], scope) },
      {
        op: "set-state",
        path: ["revision"],
        value: ref("item", ["revision"], scope),
      },
      {
        op: "set-state",
        path: ["label"],
        value:
          scope === "block"
            ? groupLabel(
                ref("item", ["data", "kind"], scope),
                ref("item", ["data", "position"], scope),
              )
            : occurrenceLabel,
      },
      { op: "open-dialog", dialog: `remove-${scope}` },
    ],
    "ghost",
  );
export const workoutStructure = workoutView({
  id: "workout-structure",
  label: "Workout structure",
  entity: true,
  state: {
    schema: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 36, maxLength: 36 },
        revision: { type: "integer" },
        label: { type: "string", maxLength: 512 },
      },
      required: ["id", "revision", "label"],
      additionalProperties: false,
    },
    initial: {
      id: "00000000-0000-0000-0000-000000000000",
      revision: 0,
      label: "",
    },
  },
  actions: [
    "get-workout-structure",
    "remove-workout-exercise",
    "remove-workout-block",
    "latest-workout-removal",
    ...recoveryActions,
  ],
  sources: [
    source("structure", "get-workout-structure", paramsId()),
    source(
      "removals",
      "latest-workout-removal",
      object({ sessionId: ref("params", ["id"]) }),
    ),
  ],
  forms: [],
  dialogs: ["occurrence", "block"].map((scope) =>
    removalConfirmation(
      `remove-${scope}`,
      scope === "block" ? "Remove group?" : "Remove exercise?",
      scope === "block" ? "remove-workout-block" : "remove-workout-exercise",
      object({
        id: ref("state", ["id"]),
        revision: ref("state", ["revision"]),
      }),
      ref("state", ["label"]),
      refresh,
    ),
  ),
  root: {
    id: "workout-structure",
    component: "page",
    props: { gap: "normal", align: "stretch" },
    children: [
      button(
        "back-workout",
        "Workout",
        navigate("workout", paramsId()),
        "ghost",
      ),
      heading("structure-heading", "Workout structure", 1),
      text(
        "workout-name",
        ref("source", ["session", "data", "title"], "structure"),
      ),
      recoveryControls("structure-undo", refresh),
      {
        id: "groups",
        component: "list",
        props: {
          items: {
            op: "filter",
            source: ref("source", ["blocks"], "structure"),
            as: "candidate",
            maxItems: 50,
            value: {
              op: "not",
              value: {
                op: "equal",
                left: ref("item", ["data", "kind"], "candidate"),
                right: literal("single"),
              },
            },
          },
          as: "block",
          key: ["id"],
          maxItems: 50,
        },
        template: {
          id: "group",
          component: "card",
          props: { gap: "small" },
          children: [
            {
              id: "group-heading",
              component: "heading",
              props: {
                text: join(
                  groupLabel(
                    ref("item", ["data", "kind"], "block"),
                    ref("item", ["data", "position"], "block"),
                  ),
                  countLabel(ref("item", ["data", "rounds"], "block"), "round"),
                ),
                level: 2,
              },
            },
            remove("block"),
          ],
        },
      },
      heading("exercises-heading", "Exercises", 2),
      {
        id: "exercises",
        component: "list",
        props: {
          items: ref("source", ["occurrences"], "structure"),
          as: "occurrence",
          key: ["id"],
          maxItems: 50,
        },
        template: {
          id: "exercise",
          component: "card",
          props: { gap: "small" },
          children: [
            text("exercise-name", occurrenceLabel),
            {
              id: "exercise-group",
              component: "list",
              props: {
                items: {
                  op: "filter",
                  source: ref("source", ["blocks"], "structure"),
                  as: "candidate-group",
                  maxItems: 50,
                  value: {
                    op: "equal",
                    left: ref("item", ["id"], "candidate-group"),
                    right: ref("item", ["data", "blockId"], "occurrence"),
                  },
                },
                as: "parent-group",
                key: ["id"],
                maxItems: 1,
              },
              template: text(
                "exercise-group-label",
                groupLabel(
                  ref("item", ["data", "kind"], "parent-group"),
                  ref("item", ["data", "position"], "parent-group"),
                ),
              ),
            },
            remove("occurrence"),
          ],
        },
      },
    ],
  },
});

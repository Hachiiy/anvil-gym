import type { NativeEvent } from "@anvil/app-sdk/author";
import {
  button,
  heading,
  literal,
  navigate,
  object,
  ref,
  text,
  type Binding,
} from "./helpers.js";
import {
  formField,
  revisionHook,
  source,
  workoutView,
} from "./workout-helpers.js";
import { groupLabel, join } from "./structure-labels.js";
import {
  arrangementRecoveryActions,
  arrangementUndo,
  orderControls,
} from "./workout-order-controls.js";

const refresh = [
  { op: "refresh-source" as const, source: "group" },
  { op: "refresh-source" as const, source: "arrangements" },
];
const submit: NativeEvent = {
  op: "submit-form",
  form: "group",
  onSuccess: [],
  onFailure: [],
};
const current = (key: string): Binding => ({
  op: "coalesce",
  left: ref("source", ["occurrences", { itemIndex: "member" }, key], "group"),
  right: ref("item", [key], "member"),
});
const occurrenceLabel = join(
  {
    op: "format",
    format: "number",
    digits: 0,
    value: ref("source", ["ordinals", { itemIndex: "member" }], "group"),
  },
  ref("item", ["data", "snapshot", "name"], "member"),
  ". ",
);
export const workoutGroup = workoutView({
  id: "workout-group",
  label: "Workout group",
  paramsSchema: {
    type: "object",
    properties: {
      id: { type: "string", minLength: 36, maxLength: 36 },
      sessionId: { type: "string", minLength: 36, maxLength: 36 },
    },
    required: ["id", "sessionId"],
    additionalProperties: false,
  },
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
    "get-workout-group",
    "configure-workout-group",
    "swap-workout-exercises",
    "move-workout-exercise",
    ...arrangementRecoveryActions,
  ],
  sources: [
    source(
      "group",
      "get-workout-group",
      object({
        id: ref("params", ["id"]),
        sessionId: ref("params", ["sessionId"]),
      }),
    ),
    source(
      "arrangements",
      "latest-workout-arrangement",
      object({ sessionId: ref("params", ["sessionId"]) }),
    ),
  ],
  forms: [
    {
      id: "group",
      action: "configure-workout-group",
      commit: "autosave",
      initial: object({
        id: ref("source", ["block", "id"], "group"),
        revision: ref("source", ["block", "revision"], "group"),
        kind: ref("source", ["block", "data", "kind"], "group"),
        rounds: ref("source", ["block", "data", "rounds"], "group"),
        notes: ref("source", ["block", "data", "notes"], "group"),
      }),
      onSuccess: [...revisionHook("group"), ...refresh],
    },
  ],
  dialogs: [
    {
      id: "group-settings",
      label: "Group settings",
      root: {
        id: "group-settings-fields",
        component: "stack",
        props: { gap: "normal" },
        children: [
          {
            id: "group-kind",
            component: "select",
            props: {
              form: "group",
              path: ["kind"],
              label: "Type",
              options: [
                { value: "single", label: "Single" },
                { value: "superset", label: "Superset" },
                { value: "circuit", label: "Circuit" },
              ],
            },
          },
          {
            id: "group-rounds",
            component: "number-field",
            props: {
              form: "group",
              path: ["rounds"],
              label: "Rounds",
              digits: 0,
            },
          },
          formField("group-notes", "Notes", "group", ["notes"], true),
        ],
      },
    },
    {
      id: "move-exercise",
      label: "Move exercise",
      root: {
        id: "move-exercise-picker",
        component: "stack",
        props: { gap: "normal" },
        children: [
          text("moving-exercise", ref("state", ["label"])),
          {
            id: "destinations",
            component: "list",
            props: {
              items: {
                op: "filter",
                source: ref("source", ["blocks"], "group"),
                as: "candidate",
                maxItems: 50,
                value: {
                  op: "and",
                  left: {
                    op: "not",
                    value: {
                      op: "equal",
                      left: ref("item", ["id"], "candidate"),
                      right: ref("params", ["id"]),
                    },
                  },
                  right: {
                    op: "not",
                    value: {
                      op: "equal",
                      left: ref("item", ["data", "kind"], "candidate"),
                      right: literal("single"),
                    },
                  },
                },
              },
              as: "destination",
              key: ["id"],
              maxItems: 50,
            },
            template: {
              id: "destination",
              component: "card",
              props: { gap: "small" },
              children: [
                text(
                  "destination-label",
                  groupLabel(
                    ref("item", ["data", "kind"], "destination"),
                    ref("item", ["data", "position"], "destination"),
                  ),
                ),
                button("move-here", "Move here", [
                  {
                    op: "invoke",
                    action: "move-workout-exercise",
                    input: object({
                      sessionId: ref("source", ["session", "id"], "group"),
                      revision: ref("source", ["session", "revision"], "group"),
                      occurrence: object({
                        id: ref("state", ["id"]),
                        revision: ref("state", ["revision"]),
                      }),
                      block: object({
                        id: ref("item", ["id"], "destination"),
                        revision: ref("item", ["revision"], "destination"),
                      }),
                    }),
                    onSuccess: [
                      { op: "close-dialog", dialog: "move-exercise" },
                      ...refresh,
                    ],
                    onFailure: [],
                  },
                ]),
              ],
            },
          },
        ],
      },
    },
  ],
  root: {
    id: "workout-group",
    component: "page",
    props: { gap: "normal", align: "stretch" },
    children: [
      button(
        "back-structure",
        "Workout structure",
        [
          submit,
          ...navigate(
            "workout-structure",
            object({ id: ref("params", ["sessionId"]) }),
          ),
        ],
        "ghost",
      ),
      heading("group-heading", "Group", 1),
      text(
        "group-name",
        groupLabel(
          ref("source", ["block", "data", "kind"], "group"),
          ref("source", ["block", "data", "position"], "group"),
        ),
      ),
      button(
        "group-settings",
        "Settings",
        [{ op: "open-dialog", dialog: "group-settings" }],
        "ghost",
      ),
      arrangementUndo(refresh, [submit]),
      {
        id: "members",
        component: "list",
        props: {
          items: ref("source", ["occurrences"], "group"),
          as: "member",
          key: ["id"],
          maxItems: 50,
        },
        template: {
          id: "member",
          component: "card",
          props: { gap: "small" },
          children: [
            text("member-name", occurrenceLabel),
            orderControls(
              "exercise-order",
              "group",
              ref("item", ["id"], "member"),
              true,
            ),
            button(
              "move-exercise",
              "Move to group",
              [
                submit,
                { op: "set-state", path: ["id"], value: current("id") },
                {
                  op: "set-state",
                  path: ["revision"],
                  value: current("revision"),
                },
                { op: "set-state", path: ["label"], value: occurrenceLabel },
                { op: "open-dialog", dialog: "move-exercise" },
              ],
              "ghost",
            ),
          ],
        },
      },
    ],
  },
});

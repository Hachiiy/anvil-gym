import type {
  NativeEvent,
  NativeNode,
  NativeViewDefinition,
} from "@anvil/app-sdk/author";
import { button, literal, object, ref, text, type Binding } from "./helpers.js";

export const removalProperties = {
  removalId: { type: "string" as const, minLength: 36, maxLength: 36 },
  removalRevision: { type: "integer" as const },
  removalOrdinal: { type: "integer" as const, minimum: 0, maximum: 10 },
};
export const removalInitial = {
  removalId: "00000000-0000-0000-0000-000000000000",
  removalRevision: 0,
  removalOrdinal: 0,
};
const refresh: Extract<NativeEvent, { op: "refresh-source" }>[] = [
  { op: "refresh-source", source: "logging" },
  { op: "refresh-source", source: "removals" },
];
const submit: NativeEvent = {
  op: "submit-form",
  form: "logging",
  onSuccess: [],
  onFailure: [],
};
export const removeSetButton = (ordinal: Binding): NativeNode =>
  button(
    "remove-set",
    "Remove",
    [
      submit,
      {
        op: "set-state",
        path: ["removalId"],
        value: ref("item", ["id"], "set"),
      },
      {
        op: "set-state",
        path: ["removalRevision"],
        value: {
          op: "coalesce",
          left: ref(
            "form",
            ["sets", { itemIndex: "set" }, "revision"],
            "logging",
          ),
          right: ref("item", ["revision"], "set"),
        },
      },
      { op: "set-state", path: ["removalOrdinal"], value: ordinal },
      { op: "open-dialog", dialog: "remove-set" },
    ],
    "ghost",
  );
export const removalDialog: NonNullable<
  NativeViewDefinition["dialogs"]
>[number] = {
  id: "remove-set",
  label: "Remove set?",
  root: {
    id: "remove-set-confirmation",
    component: "stack",
    props: { gap: "normal" },
    children: [
      text("remove-set-number", {
        op: "concat",
        left: literal("Set "),
        right: {
          op: "format",
          format: "number",
          digits: 0,
          value: ref("state", ["removalOrdinal"]),
        },
      }),
      {
        id: "remove-set-actions",
        component: "row",
        props: { gap: "small" },
        children: [
          button("confirm-remove-set", "Remove", [
            {
              op: "invoke",
              action: "remove-workout-set",
              input: object({
                id: ref("state", ["removalId"]),
                revision: ref("state", ["removalRevision"]),
              }),
              onSuccess: [
                { op: "close-dialog", dialog: "remove-set" },
                { op: "set-state", path: ["details"], value: literal("") },
                ...refresh,
              ],
              onFailure: [],
            },
          ]),
        ],
      },
    ],
  },
};
export const removalUndo: NativeNode = {
  id: "removal-undo",
  component: "list",
  props: {
    items: ref("source", ["records"], "removals"),
    as: "removal",
    key: ["id"],
    maxItems: 1,
  },
  template: {
    id: "removal-controls",
    component: "row",
    props: { gap: "small" },
    children: [
      button(
        "undo-removal",
        "Undo removal",
        [
          submit,
          {
            op: "invoke",
            action: "undo-workout-removal",
            input: object({
              id: ref("item", ["id"], "removal"),
              revision: ref("item", ["revision"], "removal"),
            }),
            onSuccess: refresh,
            onFailure: [],
          },
        ],
        "ghost",
      ),
      button(
        "dismiss-removal",
        "Dismiss",
        [
          {
            op: "invoke",
            action: "dismiss-workout-removal",
            input: object({
              id: ref("item", ["id"], "removal"),
              revision: ref("item", ["revision"], "removal"),
            }),
            onSuccess: [{ op: "refresh-source", source: "removals" }],
            onFailure: [],
          },
        ],
        "ghost",
      ),
    ],
  },
};

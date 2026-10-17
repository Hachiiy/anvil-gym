import type { NativeNode } from "@anvil/app-sdk/author";
import { muscles } from "../domain-schema.mjs";
import { button, literal, ref, stack, text, type Binding } from "./helpers.js";

const roleValues = (role: string) => ({
  op: "coalesce" as const,
  left: ref("form", ["value", "muscles", role], "exercise"),
  right: literal([]),
});
const current = ref("item", ["key"], "muscle");
const matches: Binding = {
  op: "equal",
  left: ref("item", [], "candidate"),
  right: current,
};
function selected(role: string): Binding {
  return {
    op: "greater",
    left: {
      op: "length",
      value: {
        op: "filter",
        source: roleValues(role),
        as: "candidate",
        maxItems: muscles.length,
        value: matches,
      },
    },
    right: literal(0),
  };
}
function roleButton(role: "primary" | "secondary" | "none"): NativeNode {
  return button(
    `muscle-${role}`,
    role === "none" ? "Clear" : role === "primary" ? "Primary" : "Secondary",
    ["primary", "secondary"].map((target) => {
      const remaining: Binding = {
        op: "filter",
        source: roleValues(target),
        as: "candidate",
        maxItems: muscles.length,
        value: { op: "not", value: matches },
      };
      return {
        op: "set-form" as const,
        form: "exercise",
        path: ["value", "muscles", target],
        value:
          target === role
            ? {
                op: "append" as const,
                source: remaining,
                value: current,
                maxItems: muscles.length,
              }
            : remaining,
      };
    }),
    "ghost",
  );
}
const name = (value: string) =>
  value
    .split("-")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
export const muscleEditor: NativeNode = stack("muscle-editor", [
  button(
    "toggle-muscles",
    "Muscle groups",
    [
      {
        op: "set-state",
        path: ["muscleOptions"],
        value: { op: "not", value: ref("state", ["muscleOptions"]) },
      },
    ],
    "ghost",
  ),
  {
    id: "muscle-options",
    component: "condition",
    props: { when: ref("state", ["muscleOptions"]) },
    then: stack("muscle-picker", [
      text("muscle-help", "Select a role for each muscle."),
      {
        id: "muscle-list",
        component: "list",
        props: {
          items: literal(muscles.map((key) => ({ key, label: name(key) }))),
          as: "muscle",
          key: ["key"],
          maxItems: muscles.length,
        },
        template: {
          id: "muscle-card",
          component: "card",
          props: { gap: "small" },
          children: [
            {
              id: "muscle-name",
              component: "heading",
              props: { text: ref("item", ["label"], "muscle"), level: 3 },
            },
            {
              id: "muscle-role",
              component: "badge",
              props: {
                tone: "neutral",
                text: {
                  op: "if",
                  condition: selected("primary"),
                  then: literal("Primary"),
                  else: {
                    op: "if",
                    condition: selected("secondary"),
                    then: literal("Secondary"),
                    else: literal("Unassigned"),
                  },
                },
              },
            },
            {
              id: "muscle-choices",
              component: "row",
              props: { wrap: true, gap: "small" },
              children: [
                roleButton("primary"),
                roleButton("secondary"),
                roleButton("none"),
              ],
            },
          ],
        },
      },
    ]),
  },
]);

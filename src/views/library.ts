import type { NativeNode } from "@anvil/app-sdk/author";
import { button, heading, literal, navigate, object, ref } from "./helpers.js";
import { page, source, workoutView } from "./workout-helpers.js";

function section(kind: "routine" | "exercise"): NativeNode {
  const routines = kind === "routine";
  const sourceId = routines ? "routines" : "exercises";
  return {
    id: `${kind}-section`,
    component: "stack",
    props: { gap: "normal" },
    visible: {
      op: "equal",
      left: ref("state", ["section"]),
      right: literal(sourceId),
    },
    children: [
      button(
        `new-${kind}`,
        routines ? "New routine" : "New exercise",
        navigate(`new-${kind}`),
        "primary",
      ),
      ...(!routines
        ? [
            button(
              "starter-exercises",
              "Add starter exercises",
              navigate("starter-catalog"),
              "secondary",
            ),
          ]
        : []),
      {
        id: `${kind}-list`,
        component: "list",
        props: {
          items: ref("source", [sourceId, "records"], "library"),
          as: "entry",
          key: ["id"],
          maxItems: 50,
        },
        template: {
          id: `${kind}-row`,
          component: "card",
          props: { gap: "small" },
          children: [
            {
              id: `${kind}-name`,
              component: "heading",
              props: { text: ref("item", ["data", "name"], "entry"), level: 2 },
            },
            button(
              `open-${kind}`,
              routines ? "View routine" : "Edit exercise",
              navigate(kind, object({ id: ref("item", ["id"], "entry") })),
              "secondary",
            ),
          ],
        },
      },
      button(
        `browse-${kind}`,
        routines ? "Browse all routines" : "Browse all exercises",
        navigate(sourceId),
        "ghost",
      ),
    ],
  };
}
export const library = workoutView({
  id: "library",
  label: "Library",
  state: {
    schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["routines", "exercises"],
          maxLength: 20,
        },
      },
      required: ["section"],
      additionalProperties: false,
    },
    initial: { section: "routines" },
  },
  sources: [source("library", "get-gym-library", literal({}))],
  actions: ["get-gym-library"],
  forms: [],
  root: page("library", [
    heading("library-title", "Library", 1),
    {
      id: "library-sections",
      component: "row",
      props: { gap: "small", wrap: true },
      children: [
        ...(["routines", "exercises"] as const).map((value): NativeNode => {
          const selected = button(
            `show-${value}`,
            value === "routines" ? "Routines" : "Exercises",
            [{ op: "set-state", path: ["section"], value: literal(value) }],
            "primary",
          );
          return {
            id: `select-${value}`,
            component: "condition",
            props: {
              when: {
                op: "equal",
                left: ref("state", ["section"]),
                right: literal(value),
              },
            },
            then: selected,
            else: {
              ...selected,
              id: `choose-${value}`,
              props: { ...selected.props, tone: "secondary" },
            },
          };
        }),
      ],
    },
    section("routine"),
    section("exercise"),
  ]),
});

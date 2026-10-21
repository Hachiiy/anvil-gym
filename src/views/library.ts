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
              "ghost",
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
          component: "row",
          props: { gap: "small", align: "center", wrap: true },
          children: [
            {
              id: `${kind}-name`,
              component: "text",
              props: { text: ref("item", ["data", "name"], "entry") },
            },
            button(
              `open-${kind}`,
              "Edit",
              navigate(kind, object({ id: ref("item", ["id"], "entry") })),
              "ghost",
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
        button("show-routines", "Routines", [
          { op: "set-state", path: ["section"], value: literal("routines") },
        ]),
        button("show-exercises", "Exercises", [
          { op: "set-state", path: ["section"], value: literal("exercises") },
        ]),
      ],
    },
    section("routine"),
    section("exercise"),
  ]),
});

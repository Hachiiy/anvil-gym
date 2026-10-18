import {
  button,
  heading,
  literal,
  navigate,
  object,
  ref,
  stack,
} from "./helpers.js";
import { page, paramsId, source, workoutView } from "./workout-helpers.js";

export const chooseExercise = workoutView({
  id: "choose-exercise",
  label: "Choose exercise",
  entity: true,
  forms: [],
  actions: ["list-exercises", "add-workout-exercise"],
  sources: [
    source("exercises", "list-exercises", literal({ archived: false })),
  ],
  root: page("choose-exercise", [
    button("back-workout", "Workout", navigate("workout", paramsId()), "ghost"),
    heading("choose-heading", "Add exercise", 1),
    button("exercise-library", "Exercise library", navigate("exercises")),
    {
      id: "exercise-picker",
      component: "list",
      props: {
        items: ref("source", ["records"], "exercises"),
        as: "exercise",
        key: ["id"],
        maxItems: 50,
      },
      template: {
        id: "exercise-choice",
        component: "card",
        props: { gap: "small" },
        children: [
          {
            id: "choice-name",
            component: "heading",
            props: {
              text: ref("item", ["data", "name"], "exercise"),
              level: 2,
            },
          },
          button(
            "add-chosen-exercise",
            "Add to workout",
            [
              {
                op: "invoke",
                action: "add-workout-exercise",
                input: object({
                  sessionId: ref("params", ["id"]),
                  exerciseId: ref("item", ["id"], "exercise"),
                }),
                onSuccess: [
                  {
                    op: "navigate",
                    view: "workout-exercise",
                    params: object({ id: ref("event", ["id"]) }),
                  },
                ],
                onFailure: [],
              },
            ],
            "primary",
          ),
        ],
      },
    },
  ]),
});

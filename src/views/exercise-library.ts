import { defineView } from "@anvil/app-sdk/author";
import {
  button,
  empty,
  heading,
  navigate,
  object,
  ref,
  text,
} from "./helpers.js";
import {
  exercisePaging,
  filterButton,
  libraryFilterBadges,
  libraryFeedback,
  libraryItems,
  libraryPageControls,
} from "./library-pages.js";

export const exerciseLibrary = defineView({
  id: "exercises",
  label: "Exercises",
  surface: "app",
  paramsSchema: empty,
  ...exercisePaging,
  root: {
    id: "exercise-library",
    component: "page",
    props: { gap: "normal" },
    children: [
      button("library", "Library", navigate("library"), "ghost"),
      heading("library-title", "Exercises", 1),
      {
        id: "exercise-library-actions",
        component: "row",
        props: { gap: "small", wrap: true },
        children: [
          button(
            "new-exercise",
            "New exercise",
            navigate("new-exercise"),
            "primary",
          ),
          button(
            "starter-exercises",
            "Starter exercises",
            navigate("starter-catalog"),
          ),
          filterButton,
          ...libraryFilterBadges("category", "archived"),
        ],
      },
      libraryPageControls("top"),
      ...libraryFeedback("No exercises"),
      {
        id: "exercise-list",
        component: "list",
        props: {
          items: libraryItems,
          as: "exercise",
          key: ["id"],
          maxItems: 50,
        },
        template: {
          id: "exercise-card",
          component: "card",
          props: { gap: "small" },
          children: [
            {
              id: "exercise-title",
              component: "heading",
              props: {
                text: ref("item", ["data", "name"], "exercise"),
                level: 2,
              },
            },
            {
              id: "exercise-type",
              component: "badge",
              props: { text: ref("item", ["data", "category"], "exercise") },
            },
            text(
              "exercise-equipment",
              ref("item", ["data", "equipment"], "exercise"),
            ),
            button(
              "open-exercise",
              "Open exercise",
              navigate(
                "exercise",
                object({ id: ref("item", ["id"], "exercise") }),
              ),
            ),
          ],
        },
      },
      libraryPageControls("bottom"),
    ],
  },
});

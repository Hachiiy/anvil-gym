import {
  historyPaging,
  filterButton,
  libraryFilterBadges,
  libraryFeedback,
  libraryItems,
  libraryPageControls,
} from "./library-pages.js";
import { recoveryActions, recoveryControls } from "./workout-tree-removal.js";
import type { NativeNode } from "@anvil/app-sdk/author";
import {
  button,
  heading,
  literal,
  navigate,
  object,
  ref,
  type Binding,
} from "./helpers.js";
import { page, source, workoutView } from "./workout-helpers.js";

const active: Binding = {
  op: "coalesce",
  left: ref("source", ["records"], "active"),
  right: literal([]),
};
const recent = libraryItems;
const list = (id: string, items: Binding, ongoing: boolean): NativeNode => ({
  id,
  component: "list",
  props: { items, as: "workout", key: ["id"], maxItems: 50 },
  template: {
    id: `${id}-card`,
    component: "card",
    props: { gap: "small" },
    children: [
      {
        id: `${id}-name`,
        component: "heading",
        props: { text: ref("item", ["data", "title"], "workout"), level: 2 },
      },
      {
        id: `${id}-date`,
        component: "text",
        props: {
          tone: "muted",
          text: {
            op: "format",
            format: "date",
            value: ref("item", ["data", "startedAt"], "workout"),
          },
        },
      },
      ...(!ongoing
        ? [
            {
              id: `${id}-status`,
              component: "badge" as const,
              props: { text: ref("item", ["data", "status"], "workout") },
            },
          ]
        : []),
      button(
        `${id}-open`,
        ongoing ? "Continue" : "Open workout",
        navigate("workout", object({ id: ref("item", ["id"], "workout") })),
        ongoing ? "primary" : "secondary",
      ),
    ],
  },
});
export const history = workoutView({
  id: "history",
  label: "History",
  state: historyPaging.state,
  forms: historyPaging.forms,
  dialogs: historyPaging.dialogs,
  actions: [
    ...historyPaging.actions,
    "latest-deleted-workout",
    ...recoveryActions,
  ],
  sources: [
    ...historyPaging.sources,
    {
      ...source("removals", "latest-deleted-workout", literal({})),
      refresh: "manual",
    },
  ],
  root: page("workouts", [
    heading("history-title", "History", 1),
    button(
      "recently-deleted",
      "Recently deleted",
      [{ op: "refresh-source", source: "removals" }],
      "ghost",
    ),
    recoveryControls("workout-undo", [
      {
        op: "navigate",
        view: "workout",
        params: object({ id: ref("event", ["data", "sessionId"]) }),
      },
    ]),
    {
      id: "history-heading",
      component: "row",
      props: { gap: "small", wrap: true },
      children: [filterButton, ...libraryFilterBadges("status")],
    },
    libraryPageControls("top"),
    ...libraryFeedback("No workout history"),
    list("recent-workouts", recent, false),
    libraryPageControls("bottom"),
  ]),
});

import { list, object, reference, integer } from "../schema.mjs";
import {
  batch,
  fields,
  input,
  invoke,
  item,
  readAction,
  result,
  mapped,
  literal,
  conditional,
  binary,
  length,
} from "../expressions.mjs";
import { overviewActions } from "./overview.ts";
import { readCaps, rowSchema } from "./shared.mjs";

const page = overviewActions.find(
  (action) => action.name === "get-workout-page",
)!;
const card = overviewActions.find(
  (action) => action.name === "get-workout-card",
)!;
export const workoutScreenAction = {
  ...readAction(
    "get-workout-screen",
    "Read the workout and its present exercise cards together; history is requested separately",
    object({ sessionId: reference, page: integer(0, 8) }),
    [
      invoke("workout", "get-workout", fields({ id: input("sessionId") })),
      invoke(
        "page",
        "get-workout-page",
        fields({ sessionId: input("sessionId"), page: input("page") }),
      ),
      batch(
        "cards",
        "get-workout-logging",
        result("page", "records"),
        fields({ id: item("id") }),
        6,
      ),
    ],
    object({
      workout: rowSchema("session"),
      page: page.resultSchema,
      cards: list(card.resultSchema, 6, 6),
    }),
    fields({
      workout: result("workout"),
      page: result("page"),
      cards: mapped(
        literal([0, 1, 2, 3, 4, 5]),
        conditional(
          binary("less", item(), length(result("cards", "results"))),
          { op: "at", source: result("cards", "results"), index: item() },
          literal({
            records: [],
            sets: [],
            ordinals: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          }),
        ),
        6,
      ),
    }),
  ),
  capabilities: readCaps("session", "occurrence", "block", "set"),
};

import { object } from "../schema.mjs";
import {
  fields,
  invoke,
  literal,
  readAction,
  result,
} from "../expressions.mjs";
import { libraryPage } from "../library-summary.mjs";
import { readCaps, rowSchema } from "./shared.mjs";
import { list, text } from "../schema.mjs";

const active = object(
  { records: list(rowSchema("session"), 50), nextCursor: text(65536) },
  ["records"],
);
const routines = () =>
  invoke(
    "routines",
    "browse-routine-library",
    literal({ archived: false, cursor: "" }),
  );
export const homeActions = [
  {
    ...readAction(
      "get-training-home",
      "Read active workouts and compact routine choices together",
      object({}),
      [invoke("active", "list-active-workouts", literal({})), routines()],
      object({ active, routines: libraryPage("routine") }),
      fields({ active: result("active"), routines: result("routines") }),
    ),
    capabilities: readCaps("session", "routine"),
  },
  {
    ...readAction(
      "get-gym-library",
      "Read the first compact routine and exercise pages together",
      object({}),
      [
        routines(),
        invoke(
          "exercises",
          "browse-exercise-library",
          literal({ archived: false, category: "all", cursor: "" }),
        ),
      ],
      object({
        routines: libraryPage("routine"),
        exercises: libraryPage("exercise"),
      }),
      fields({ routines: result("routines"), exercises: result("exercises") }),
    ),
    capabilities: readCaps("routine", "exercise"),
  },
];

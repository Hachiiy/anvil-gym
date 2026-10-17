import { integer, list, object, reference } from "../schema.mjs";
import {
  fields,
  filtered,
  input,
  item,
  length,
  literal,
  readAction,
  result,
  batch,
} from "../expressions.mjs";
import { get, query, readCaps, rowSchema } from "./shared.mjs";
import { recordSchemas } from "../domain-schema.mjs";

const outlinedOccurrence = object({
  ...rowSchema("occurrence").properties,
  kind: recordSchemas.block.properties.kind,
  rounds: recordSchemas.block.properties.rounds,
  blockPosition: recordSchemas.block.properties.position,
  sets: integer(0, 10),
  completed: integer(0, 10),
});
export const workoutOutlineActions = [
  {
    ...readAction(
      "describe-workout-occurrence",
      "Read a workout occurrence with its group and set counts",
      object({ id: reference }),
      [
        get("occurrence", "occurrence", input("id")),
        get("block", "block", result("occurrence", "data", "blockId")),
        query("sets", "set", "occurrenceId", input("id"), 10),
      ],
      outlinedOccurrence,
      fields({
        id: result("occurrence", "id"),
        revision: result("occurrence", "revision"),
        data: result("occurrence", "data"),
        kind: result("block", "data", "kind"),
        rounds: result("block", "data", "rounds"),
        blockPosition: result("block", "data", "position"),
        sets: length(result("sets", "records")),
        completed: length(
          filtered(result("sets", "records"), item("data", "completed"), 10),
        ),
      }),
    ),
    capabilities: readCaps("occurrence", "block", "set"),
  },
  {
    ...readAction(
      "list-workout-outline",
      "List a workout's ordered exercises with group and recording counts",
      object({ sessionId: reference }),
      [
        get("session", "session", input("sessionId")),
        query("page", "occurrence", "sessionId", input("sessionId"), 50),
        batch(
          "outline",
          "describe-workout-occurrence",
          result("page", "records"),
          fields({ id: item("id") }),
          50,
        ),
      ],
      object({ records: list(outlinedOccurrence, 50) }),
      fields({ records: result("outline", "results") }),
    ),
    capabilities: readCaps("session", "occurrence", "block", "set"),
  },
];

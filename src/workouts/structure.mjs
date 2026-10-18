import { integer, list, object } from "../schema.mjs";
import { fields, input, literal, readAction, result } from "../expressions.mjs";
import { entityInput, get, query, readCaps, rowSchema } from "./shared.mjs";

export const structureActions = [
  {
    ...readAction(
      "get-workout-structure",
      "Read the canonical groups and exercise occurrences in one workout",
      entityInput,
      [
        get("session", "session", input("id")),
        query("blocks", "block", "sessionId", result("session", "id"), 50),
        query(
          "occurrences",
          "occurrence",
          "sessionId",
          result("session", "id"),
          50,
        ),
      ],
      object({
        session: rowSchema("session"),
        blocks: list(rowSchema("block"), 50),
        occurrences: list(rowSchema("occurrence"), 50),
        ordinals: list(integer(1, 50), 50, 50),
      }),
      fields({
        session: result("session"),
        blocks: result("blocks", "records"),
        occurrences: result("occurrences", "records"),
        ordinals: literal(Array.from({ length: 50 }, (_, i) => i + 1)),
      }),
    ),
    capabilities: readCaps("session", "block", "occurrence"),
  },
];

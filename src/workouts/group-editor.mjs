import {
  occurrenceSummary,
  occurrenceSummaries,
} from "./occurrence-summary.mjs";
import { integer, list, object, reference } from "../schema.mjs";
import {
  assertion,
  equal,
  fields,
  input,
  literal,
  readAction,
  result,
} from "../expressions.mjs";
import { get, query, readCaps, rowSchema } from "./shared.mjs";
import {
  orderedEntries,
  orderEntry,
  orderReferences,
} from "./order-expressions.mjs";

export const groupEditorAction = {
  ...readAction(
    "get-workout-group",
    "Read one group's settings, ordered exercises and destination groups",
    object({ id: reference, sessionId: reference }),
    [
      get("block", "block", input("id")),
      assertion(
        "same-workout",
        equal(result("block", "data", "sessionId"), input("sessionId")),
        "This group belongs to another workout.",
      ),
      get("session", "session", result("block", "data", "sessionId")),
      query("occurrences", "occurrence", "blockId", result("block", "id"), 50),
      query("blocks", "block", "sessionId", result("session", "id"), 50),
      orderReferences("references", "occurrences"),
    ],
    object({
      block: rowSchema("block"),
      session: rowSchema("session"),
      occurrences: list(occurrenceSummary, 50),
      blocks: list(rowSchema("block"), 50),
      order: list(orderEntry, 50),
      ordinals: list(integer(1, 50), 50, 50),
    }),
    fields({
      block: result("block"),
      session: result("session"),
      occurrences: occurrenceSummaries("occurrences"),
      blocks: result("blocks", "records"),
      order: orderedEntries("references"),
      ordinals: literal(Array.from({ length: 50 }, (_, i) => i + 1)),
    }),
  ),
  capabilities: readCaps("session", "block", "occurrence"),
};

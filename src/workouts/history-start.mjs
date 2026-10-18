import { object, reference, text } from "../schema.mjs";
import {
  assertion,
  batch,
  binary,
  equal,
  fields,
  input,
  item,
  length,
  literal,
  result,
} from "../expressions.mjs";
import { create, get, query, rowSchema } from "./shared.mjs";
import { historyCaps } from "./history-copy.mjs";

export const historyStartAction = {
  name: "start-history-workout",
  summary: "Repeat a completed workout as a new independent plan",
  effect: "transaction",
  capabilities: historyCaps,
  inputSchema: object({
    id: reference,
    revision: { type: "integer" },
    timeZone: text(100),
  }),
  resultSchema: rowSchema("session"),
  recipe: {
    version: 1,
    steps: [
      get("source", "session", input("id")),
      assertion(
        "revision",
        equal(result("source", "revision"), input("revision")),
        "This workout changed. Reload it before repeating.",
      ),
      assertion(
        "completed-workout",
        equal(result("source", "data", "status"), literal("completed")),
        "Choose a completed workout.",
      ),
      query("blocks", "block", "sessionId", input("id"), 50),
      query("occurrences", "occurrence", "sessionId", input("id"), 50),
      query("sets", "set", "sessionId", input("id"), 100),
      ...["blocks", "occurrences", "sets"].map((page) =>
        assertion(
          `${page}-bound`,
          {
            op: "not",
            value: { op: "has", source: result(page), path: ["nextCursor"] },
          },
          "Use fewer exercises or sets for a single repeated workout.",
        ),
      ),
      assertion(
        "nonempty-workout",
        binary("greater", length(result("occurrences", "records")), literal(0)),
        "Add an exercise before repeating this workout.",
      ),
      assertion(
        "workout-budget",
        {
          op: "not",
          value: binary(
            "greater",
            binary(
              "add",
              literal(1),
              binary(
                "add",
                length(result("blocks", "records")),
                binary(
                  "add",
                  length(result("occurrences", "records")),
                  length(result("sets", "records")),
                ),
              ),
            ),
            literal(100),
          ),
        },
        "Use fewer exercises, sets or rounds for this workout.",
      ),
      { id: "started", op: "let", value: { op: "now" } },
      create(
        "session",
        "session",
        fields({
          title: result("source", "data", "title"),
          startedAt: result("started"),
          timeZone: input("timeZone"),
          dateKey: {
            op: "date-key",
            value: result("started"),
            timeZone: input("timeZone"),
          },
          status: literal("active"),
          notes: result("source", "data", "notes"),
          sourceKind: literal("history"),
          sourceId: input("id"),
        }),
      ),
      batch(
        "copied",
        "copy-history-block",
        result("blocks", "records"),
        fields({
          sourceId: item("id"),
          sessionId: result("session", "id"),
        }),
        50,
      ),
    ],
    result: result("session"),
  },
};

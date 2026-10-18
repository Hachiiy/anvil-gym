import { recordReference } from "../domain-schema.mjs";
import { list, object, reference } from "../schema.mjs";
import {
  batch,
  fields,
  input,
  item,
  literal,
  result,
} from "../expressions.mjs";
import { get, readCaps, writeCaps } from "./shared.mjs";
import {
  removalContext,
  removalRecordInput,
  sameSession,
} from "./removal-shared.mjs";

export const removalDeleteActions = [
  {
    name: "delete-workout-set-group",
    summary:
      "Delete a bounded set group inside an admitted removal transaction",
    effect: "transaction",
    capabilities: [...readCaps("removal", "set"), ...writeCaps("set")],
    inputSchema: object({
      removalId: reference,
      records: list(recordReference, 10),
    }),
    resultSchema: object({}),
    recipe: {
      version: 1,
      steps: [
        ...removalContext("preparing"),
        batch(
          "sets",
          "delete-workout-set",
          input("records"),
          fields({
            removalId: input("removalId"),
            id: item("id"),
            revision: item("revision"),
          }),
          10,
        ),
      ],
      result: literal({}),
    },
  },
  ...["set", "occurrence", "block", "session"].map((table) => ({
    name: `delete-workout-${table}`,
    summary: `Delete an observed ${table} only inside its admitted removal transaction`,
    effect: "transaction",
    capabilities: [...readCaps("removal", table), ...writeCaps(table)],
    inputSchema: removalRecordInput,
    resultSchema: object({}),
    recipe: {
      version: 1,
      steps: [
        ...removalContext("preparing"),
        get("record", table, input("id")),
        sameSession(
          "record",
          table === "session" ? result("record", "id") : undefined,
        ),
        {
          id: "deleted",
          op: "delete",
          table,
          recordId: input("id"),
          revision: input("revision"),
        },
      ],
      result: literal({}),
    },
  })),
];

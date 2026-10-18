import { recordReference } from "../domain-schema.mjs";
import { list, object, reference } from "../schema.mjs";
import {
  assertion,
  batch,
  binary,
  equal,
  fields,
  input,
  item,
  literal,
  result,
} from "../expressions.mjs";
import { readCaps, writeCaps } from "./shared.mjs";
import {
  removalContext,
  removalRecordInput,
  sameSession,
} from "./removal-shared.mjs";

export const removalRestoreActions = [
  {
    name: "restore-workout-set-group",
    summary: "Restore a bounded set group inside an admitted Undo transaction",
    effect: "transaction",
    capabilities: [...readCaps("removal"), ...writeCaps("set")],
    inputSchema: object({
      removalId: reference,
      records: list(recordReference, 10),
    }),
    resultSchema: object({}),
    recipe: {
      version: 1,
      steps: [
        ...removalContext("restoring"),
        batch(
          "sets",
          "restore-workout-set",
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
  ...["session", "block", "occurrence", "set"].map((table) => ({
    name: `restore-workout-${table}`,
    summary: `Restore canonical ${table} data only inside its admitted Undo transaction`,
    effect: "transaction",
    capabilities: [...readCaps("removal"), ...writeCaps(table)],
    inputSchema: removalRecordInput,
    resultSchema: recordReference,
    recipe: {
      version: 1,
      steps: [
        ...removalContext("restoring"),
        {
          id: "saved",
          op: "restore",
          table,
          recordId: input("id"),
          revision: input("revision"),
        },
        sameSession(
          "saved",
          table === "session" ? result("saved", "id") : undefined,
        ),
        ...(table === "set"
          ? [
              assertion(
                "same-occurrence",
                binary(
                  "or",
                  {
                    op: "not",
                    value: equal(
                      result("removal", "data", "scope"),
                      literal("set"),
                    ),
                  },
                  equal(
                    result("saved", "data", "occurrenceId"),
                    result("removal", "data", "contextId"),
                  ),
                ),
                "The set belongs to another exercise occurrence.",
              ),
            ]
          : []),
      ],
      result: fields({
        id: result("saved", "id"),
        revision: result("saved", "revision"),
      }),
    },
  })),
];

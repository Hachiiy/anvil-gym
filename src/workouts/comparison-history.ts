import type { AppExpression } from "@anvil/app-sdk/author";
import { plannedSet } from "../domain-schema.mjs";
import { measurements, metricSnapshot } from "../metric-schema.mjs";
import { integer, list, object, text } from "../schema.mjs";
import {
  batch,
  binary,
  conditional,
  equal,
  fields,
  filtered,
  input,
  item,
  length,
  literal,
  mapped,
  readAction,
  result,
} from "../expressions.mjs";
import { readCaps, rowSchema } from "./shared.mjs";

export const historicalSet = object({
  position: integer(0, 1000000),
  round: integer(1, 100),
  kind: plannedSet.properties.kind,
  actual: measurements,
});
export const historicalExercise = object({
  dateKey: text(10),
  definitions: metricSnapshot,
  records: list(historicalSet, 10),
});
export const exists = (value: AppExpression) =>
  binary("greater", length(value), literal(0));
export const at = (
  value: AppExpression,
  index: AppExpression = literal(0),
): AppExpression => ({ op: "at", source: value, index });
export const letValue = (id: string, value: AppExpression) => ({
  id,
  op: "let",
  value,
});
const project = (value: AppExpression, ...path: string[]) =>
  at(mapped(value, item(...path), 1));

export const comparisonHistoryActions = [
  {
    ...readAction(
      "read-comparison-history",
      "Read a completed workout's matching exercise once for all set comparisons",
      object({
        session: rowSchema("session"),
        exercise: rowSchema("occurrence"),
      }),
      [
        {
          id: "occurrences",
          op: "query",
          table: "occurrence",
          where: [
            {
              field: ["sessionId"],
              compare: "eq",
              value: input("session", "id"),
            },
            {
              field: ["snapshot", "exerciseId"],
              compare: "eq",
              value: input("exercise", "data", "snapshot", "exerciseId"),
            },
          ],
          order: [{ field: ["position"], direction: "asc" }],
          limit: 50,
        },
        letValue(
          "same-position",
          filtered(
            result("occurrences", "records"),
            equal(
              item("data", "position"),
              input("exercise", "data", "position"),
            ),
            50,
          ),
        ),
        letValue(
          "choice",
          conditional(
            exists(result("same-position")),
            { op: "array", items: [at(result("same-position"))] },
            conditional(
              exists(result("occurrences", "records")),
              { op: "array", items: [at(result("occurrences", "records"))] },
              literal([]),
            ),
          ),
        ),
        batch(
          "sets",
          "list-workout-sets",
          result("choice"),
          fields({ occurrenceId: item("id") }),
          1,
        ),
      ],
      historicalExercise,
      fields({
        dateKey: input("session", "data", "dateKey"),
        definitions: conditional(
          exists(result("choice")),
          project(result("choice"), "data", "snapshot", "metrics"),
          input("exercise", "data", "snapshot", "metrics"),
        ),
        records: conditional(
          exists(result("sets", "results")),
          mapped(
            filtered(
              project(result("sets", "results"), "records"),
              item("data", "completed"),
              10,
            ),
            fields(
              Object.fromEntries(
                ["position", "round", "kind", "actual"].map((key) => [
                  key,
                  item("data", key),
                ]),
              ),
            ),
            10,
          ),
          literal([]),
        ),
      }),
    ),
    capabilities: readCaps("occurrence", "set"),
  },
];

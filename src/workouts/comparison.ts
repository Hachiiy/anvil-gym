import type { AppExpression } from "@anvil/app-sdk/author";
import { flag, list, object, reference, text } from "../schema.mjs";
import {
  batch,
  binary,
  conditional,
  fields,
  filtered,
  input,
  invoke,
  item,
  length,
  literal,
  readAction,
  result,
} from "../expressions.mjs";
import { draftMeasurements } from "./sets.mjs";
import { readCaps, rowSchema } from "./shared.mjs";

const at = (source: AppExpression): AppExpression => ({
  op: "at",
  source,
  index: literal(0),
});
const exists = (source: AppExpression) =>
  binary("greater", length(source), literal(0));
const comparison = object({
  id: reference,
  available: flag,
  values: draftMeasurements,
  dateKey: text(10),
});
const caps = readCaps("session", "occurrence", "block", "set");

export const comparisonActions = [
  {
    ...readAction(
      "compare-workout-set",
      "Read compatible completed previous values for this set's kind, round and position",
      object({ set: rowSchema("set") }),
      [
        invoke(
          "previous",
          "previous-workout-targets",
          fields({ id: input("set", "id") }),
        ),
      ],
      comparison,
      fields({
        id: input("set", "id"),
        available: result("previous", "available"),
        values: result("previous", "values"),
        dateKey: conditional(
          result("previous", "available"),
          result("previous", "source", "dateKey"),
          literal(""),
        ),
      }),
    ),
    capabilities: caps,
  },
  {
    ...readAction(
      "get-workout-comparison",
      "Read each set's compatible previous values and source date without changing targets or actuals",
      object({ ids: list(reference, 1) }),
      [
        batch(
          "current-read",
          "get-workout-logging",
          input("ids"),
          fields({ id: item() }),
          1,
        ),
        {
          id: "current",
          op: "let",
          value: conditional(
            exists(result("current-read", "results")),
            at(result("current-read", "results")),
            literal({ records: [] }),
          ),
        },
        batch(
          "sets",
          "compare-workout-set",
          result("current", "records"),
          fields({ set: item() }),
          10,
        ),
        {
          id: "available",
          op: "let",
          value: filtered(result("sets", "results"), item("available"), 10),
        },
      ],
      object({ records: list(comparison, 10), dateKey: text(10) }),
      fields({
        records: result("sets", "results"),
        dateKey: conditional(
          exists(result("available")),
          at({
            op: "map",
            source: result("available"),
            value: item("dateKey"),
            maxItems: 10,
          }),
          literal(""),
        ),
      }),
    ),
    capabilities: caps,
  },
];

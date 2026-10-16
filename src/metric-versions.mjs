import { integer, list, object } from "./schema.mjs";
import { authoredMetric, metricDefinition } from "./metric-schema.mjs";
import {
  all,
  conditional,
  equal,
  fields,
  filtered,
  input,
  item,
  length,
  literal,
  readAction,
  result,
} from "./expressions.mjs";

const authoredKeys = Object.keys(authoredMetric.properties);
const semanticKeys = authoredKeys.filter(
  (key) => key !== "label" && key !== "key",
);
const authoredValue = Object.fromEntries(
  authoredKeys.map((key) => [key, input("definition", key)]),
);

export const metricVersionAction = readAction(
  "normalize-metric-version",
  "Assign metric meaning versions while preserving compatible historical identity",
  object({
    definition: authoredMetric,
    previous: list(metricDefinition, 12),
    nextVersion: integer(1, 1000000000),
  }),
  [
    {
      id: "matching",
      op: "let",
      value: filtered(
        input("previous"),
        equal(item("key"), input("definition", "key")),
      ),
    },
    {
      id: "previous",
      op: "let",
      value: conditional(
        equal(length(result("matching")), literal(1)),
        { op: "at", source: result("matching"), index: literal(0) },
        fields({ ...authoredValue, version: input("nextVersion") }),
      ),
    },
  ],
  metricDefinition,
  fields({
    ...authoredValue,
    version: conditional(
      all(
        ...semanticKeys.map((key) =>
          equal(input("definition", key), result("previous", key)),
        ),
      ),
      result("previous", "version"),
      input("nextVersion"),
    ),
  }),
);

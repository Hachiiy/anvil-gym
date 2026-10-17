import {
  routineBlock,
  routineOccurrence,
  plannedSet,
} from "../domain-schema.mjs";
import { metricSnapshot } from "../metric-schema.mjs";
import { list, object, reference } from "../schema.mjs";
import {
  assertion,
  batch,
  equal,
  fields,
  filtered,
  input,
  item,
  length,
  literal,
  mapped,
  readAction,
} from "../expressions.mjs";

const unique = (key, keys) =>
  assertion(
    "unique-key",
    equal(length(filtered(keys, equal(item(), key), 30)), literal(1)),
    "Each routine item needs a distinct identity.",
  );

export const routineValidationActions = [
  readAction(
    "validate-routine-set",
    "Validate planned values against pinned meanings",
    object({ set: plannedSet, definitions: metricSnapshot }),
    [
      batch(
        "values",
        "validate-measurement",
        input("set", "values"),
        fields({
          measurement: item(),
          values: input("set", "values"),
          definitions: input("definitions"),
        }),
      ),
    ],
    object({}),
    literal({}),
  ),
  readAction(
    "validate-routine-occurrence",
    "Validate one reusable exercise occurrence",
    object({ occurrence: routineOccurrence, keys: list(reference, 12) }),
    [
      unique(input("occurrence", "key"), input("keys")),
      assertion(
        "exercise-identity",
        equal(
          input("occurrence", "exerciseId"),
          input("occurrence", "snapshot", "exerciseId"),
        ),
        "The exercise and its snapshot must match.",
      ),
      batch(
        "sets",
        "validate-routine-set",
        input("occurrence", "sets"),
        fields({
          set: item(),
          definitions: input("occurrence", "snapshot", "metrics"),
        }),
        20,
      ),
    ],
    object({}),
    literal({}),
  ),
  readAction(
    "validate-routine-block",
    "Validate a routine block and its planned sets",
    object({ block: routineBlock, keys: list(reference, 30) }),
    [
      unique(input("block", "key"), input("keys")),
      assertion(
        "single-exercise",
        {
          op: "or",
          left: {
            op: "not",
            value: equal(input("block", "kind"), literal("single")),
          },
          right: equal(length(input("block", "occurrences")), literal(1)),
        },
        "A single block contains one exercise. Choose a superset or circuit for more.",
      ),
      batch(
        "occurrences",
        "validate-routine-occurrence",
        input("block", "occurrences"),
        fields({
          occurrence: item(),
          keys: mapped(input("block", "occurrences"), item("key")),
        }),
      ),
    ],
    object({}),
    literal({}),
  ),
];

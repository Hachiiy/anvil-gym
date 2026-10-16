import { flag, object } from "./schema.mjs";
import {
  metricDefinition,
  measuredValue,
  measurements,
  metricSnapshot,
} from "./metric-schema.mjs";
import {
  all,
  any,
  assertion,
  binary,
  equal,
  filtered,
  input,
  item,
  length,
  literal,
  not,
  oneOf,
  readAction,
  result,
} from "./expressions.mjs";

const validSchema = object({ valid: flag });
const validResult = { op: "object", fields: { valid: literal(true) } };
const definition = (...path) => input("definition", ...path);
const matchKey = (source, key) => filtered(source, equal(item("key"), key));
const lessOrEqual = (left, right) => not(binary("greater", left, right));
const greaterOrEqual = (left, right) => not(binary("less", left, right));
const implies = (condition, consequent) => any(not(condition), consequent);

export const metricActions = [
  readAction(
    "validate-metric-definition",
    "Validate a custom metric definition and its unique key",
    object({ definition: metricDefinition, definitions: metricSnapshot }),
    [
      assertion(
        "unique-key",
        equal(
          length(matchKey(input("definitions"), definition("key"))),
          literal(1),
        ),
        "Each metric key must appear exactly once.",
      ),
      assertion(
        "bounds",
        lessOrEqual(definition("minimum"), definition("maximum")),
        "A metric minimum cannot exceed its maximum.",
      ),
      assertion(
        "unsigned",
        implies(
          not(definition("signed")),
          greaterOrEqual(definition("minimum"), literal(0)),
        ),
        "Negative values require an explicitly signed metric.",
      ),
      assertion(
        "integer-precision",
        implies(
          equal(definition("kind"), literal("integer")),
          equal(definition("precision"), literal(0)),
        ),
        "Integer metrics require zero decimal places.",
      ),
      assertion(
        "load-meaning",
        implies(
          not(equal(definition("loadMeaning"), literal("none"))),
          equal(definition("dimension"), literal("mass")),
        ),
        "Load meaning belongs to a mass measurement.",
      ),
      ...Object.entries({
        mass: ["kg", "g", "lb"],
        length: ["m", "km", "mi"],
        duration: ["s", "min", "h"],
      }).map(([dimension, units]) =>
        assertion(
          `unit-${dimension}`,
          implies(
            equal(definition("dimension"), literal(dimension)),
            oneOf(definition("unit"), units),
          ),
          "Choose a supported unit for this measurement dimension.",
        ),
      ),
    ],
    validSchema,
    validResult,
  ),
  readAction(
    "validate-measurement",
    "Validate a supplied measurement against its pinned metric snapshot",
    object({
      measurement: measuredValue,
      values: measurements,
      definitions: metricSnapshot,
    }),
    [
      {
        id: "matching",
        op: "let",
        value: matchKey(input("definitions"), input("measurement", "key")),
      },
      assertion(
        "known-key",
        equal(length(result("matching")), literal(1)),
        "The measurement has no unique metric definition.",
      ),
      assertion(
        "unique-value",
        equal(
          length(matchKey(input("values"), input("measurement", "key"))),
          literal(1),
        ),
        "Each measurement key must appear once.",
      ),
      {
        id: "metric",
        op: "let",
        value: { op: "at", source: result("matching"), index: literal(0) },
      },
      assertion(
        "unit",
        equal(input("measurement", "unit"), result("metric", "unit")),
        "Measurement units must match the pinned metric.",
      ),
      assertion(
        "range",
        all(
          greaterOrEqual(
            input("measurement", "value"),
            result("metric", "minimum"),
          ),
          lessOrEqual(
            input("measurement", "value"),
            result("metric", "maximum"),
          ),
        ),
        "The measurement is outside its allowed range.",
      ),
      assertion(
        "precision",
        any(
          ...Array.from({ length: 9 }, (_, digits) =>
            all(
              equal(result("metric", "precision"), literal(digits)),
              equal(input("measurement", "value"), {
                op: "round",
                value: input("measurement", "value"),
                digits,
              }),
            ),
          ),
        ),
        "The measurement exceeds its allowed precision.",
      ),
      assertion(
        "whole-number",
        implies(
          equal(result("metric", "kind"), literal("integer")),
          equal(input("measurement", "value"), {
            op: "round",
            value: input("measurement", "value"),
            digits: 0,
          }),
        ),
        "An integer metric requires a whole number.",
      ),
    ],
    validSchema,
    validResult,
  ),
  readAction(
    "validate-required-measurement",
    "Check required metrics only when performed values are completed",
    object({
      definition: metricDefinition,
      values: measurements,
      enforceRequired: flag,
    }),
    [
      assertion(
        "required",
        implies(
          all(input("enforceRequired"), definition("required")),
          equal(
            length(matchKey(input("values"), definition("key"))),
            literal(1),
          ),
        ),
        "A completed set is missing a required measurement.",
      ),
    ],
    validSchema,
    validResult,
  ),
];

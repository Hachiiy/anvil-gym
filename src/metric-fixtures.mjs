import { defaultMetrics } from "./metric-schema.mjs";

const reps = defaultMetrics.repetitions;
const load = defaultMetrics.load;
const temperature = {
  ...reps,
  key: "temperature",
  label: "Temperature",
  kind: "decimal",
  dimension: "custom",
  unit: "celsius",
  signed: true,
  minimum: -100,
  maximum: 100,
  precision: 1,
};
const definitionCase = (
  label,
  definition,
  valid = true,
  definitions = [definition],
) => ({
  label,
  action: "validate-metric-definition",
  valid,
  input: { definition, definitions },
});
const valueCase = (
  label,
  definition,
  value,
  valid = true,
  unit = definition.unit,
) => {
  const measurement = { key: definition.key, value, unit };
  return {
    label,
    action: "validate-measurement",
    valid,
    input: { measurement, values: [measurement], definitions: [definition] },
  };
};
export const metricCases = [
  definitionCase("count definition", reps),
  definitionCase("explicit signed custom metric", temperature),
  definitionCase("duplicate metric keys", reps, false, [reps, reps]),
  definitionCase(
    "negative range needs signed policy",
    { ...temperature, signed: false },
    false,
  ),
  definitionCase(
    "reversed bounds",
    { ...reps, minimum: 20, maximum: 10 },
    false,
  ),
  definitionCase("integer precision", { ...reps, precision: 2 }, false),
  definitionCase(
    "load meaning requires mass",
    { ...reps, loadMeaning: "per-dumbbell" },
    false,
  ),
  definitionCase(
    "known dimension requires compatible unit",
    { ...load, unit: "m" },
    false,
  ),
  valueCase("observed zero", reps, 0),
  valueCase("whole repetitions", reps, 12),
  valueCase("fractional repetitions", reps, 12.5, false),
  valueCase("weight precision", load, 22.125),
  valueCase("excess precision", load, 22.1255, false),
  valueCase("unit mismatch", load, 20, false, "lb"),
  valueCase("negative unsigned load", load, -1, false),
  valueCase("signed custom value", temperature, -3.5),
  ...[false, true].map((enforceRequired) => ({
    label: enforceRequired
      ? "completed values require observations"
      : "planned unknowns remain unknown",
    action: "validate-required-measurement",
    valid: !enforceRequired,
    input: { definition: reps, values: [], enforceRequired },
  })),
  {
    label: "unknown measurement key",
    action: "validate-measurement",
    valid: false,
    input: {
      measurement: { key: "missing", value: 1, unit: "rep" },
      values: [{ key: "missing", value: 1, unit: "rep" }],
      definitions: [reps],
    },
  },
  {
    label: "duplicate measured keys",
    action: "validate-measurement",
    valid: false,
    input: {
      measurement: { key: reps.key, value: 1, unit: reps.unit },
      values: [1, 2].map((value) => ({
        key: reps.key,
        value,
        unit: reps.unit,
      })),
      definitions: [reps],
    },
  },
];

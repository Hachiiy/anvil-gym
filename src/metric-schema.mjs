import {
  choice,
  flag,
  integer,
  list,
  numeric,
  object,
  text,
} from "./schema.mjs";

export const loadMeanings = [
  "none",
  "total",
  "per-dumbbell",
  "added",
  "assistance",
];
export const metricDefinition = object({
  key: text(64, 1),
  version: integer(1, 1000000000),
  label: text(80, 1),
  kind: choice("integer", "decimal"),
  dimension: choice("count", "mass", "length", "duration", "custom"),
  unit: text(24, 1),
  loadMeaning: choice(...loadMeanings),
  minimum: numeric(-1000000000, 1000000000),
  maximum: numeric(-1000000000, 1000000000),
  precision: integer(0, 8),
  required: flag,
  signed: flag,
});

// Unknown measurements have no entry. A stored numeric zero is an observation.
export const measuredValue = object({
  key: text(64, 1),
  value: numeric(-1000000000, 1000000000),
  unit: text(24, 1),
});
export const measurements = list(measuredValue, 12);
export const metricSnapshot = list(metricDefinition, 12, 1);
export const authoredMetric = object(
  Object.fromEntries(
    Object.entries(metricDefinition.properties).filter(
      ([key]) => key !== "version",
    ),
  ),
);
export const authoredMetrics = list(authoredMetric, 12, 1);

// These are defaults for authoring exercises, never inferred from their names.
export const defaultMetrics = {
  repetitions: {
    key: "repetitions",
    version: 1,
    label: "Reps",
    kind: "integer",
    dimension: "count",
    unit: "rep",
    loadMeaning: "none",
    minimum: 0,
    maximum: 1000000,
    precision: 0,
    required: true,
    signed: false,
  },
  load: {
    key: "load",
    version: 1,
    label: "Weight",
    kind: "decimal",
    dimension: "mass",
    unit: "kg",
    loadMeaning: "total",
    minimum: 0,
    maximum: 1000000,
    precision: 3,
    required: false,
    signed: false,
  },
  duration: {
    key: "duration",
    version: 1,
    label: "Time",
    kind: "decimal",
    dimension: "duration",
    unit: "s",
    loadMeaning: "none",
    minimum: 0,
    maximum: 1000000000,
    precision: 3,
    required: true,
    signed: false,
  },
  distance: {
    key: "distance",
    version: 1,
    label: "Distance",
    kind: "decimal",
    dimension: "length",
    unit: "m",
    loadMeaning: "none",
    minimum: 0,
    maximum: 1000000000,
    precision: 3,
    required: false,
    signed: false,
  },
};

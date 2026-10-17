import entries from "../data/starter-catalog.json" with { type: "json" };
import provenance from "../data/starter-catalog.provenance.json" with { type: "json" };
import { defaultMetrics, authoredMetrics } from "./metric-schema.mjs";
import { muscleRoles, recordSchemas } from "./domain-schema.mjs";
import { choice, integer, list, object, reference, text } from "./schema.mjs";

// Broad source shoulders do not identify a particular deltoid region.
// Upper back deliberately groups the source's middle back and trapezius labels.
export const sourceMuscles = {
  abdominals: "abs",
  biceps: "biceps",
  calves: "calves",
  chest: "chest",
  forearms: "forearms",
  glutes: "glutes",
  hamstrings: "hamstrings",
  lats: "lats",
  "lower back": "lower-back",
  "middle back": "upper-back",
  quadriceps: "quadriceps",
  shoulders: null,
  traps: "upper-back",
  triceps: "triceps",
};
export const catalogSource = {
  source: provenance.source,
  commit: provenance.commit,
  license: provenance.license,
  mappingVersion: 1,
};
const originalSchema = object({
  id: text(200, 1),
  name: text(120, 1),
  equipment: text(100),
  category: choice("strength", "cardio"),
  primaryMuscles: list(text(100), 18),
  secondaryMuscles: list(text(100), 18),
});
const sourceIdentity = {
  ...text(200, 1),
  enum: entries.map((entry) => entry.id),
};
export const catalogEntrySchema = object({
  sourceId: sourceIdentity,
  original: originalSchema,
  unmapped: text(400),
  value: object({
    ...recordSchemas.exercise.properties,
    muscles: muscleRoles,
    metrics: authoredMetrics,
  }),
});
export const catalogInput = object({
  sourceId: sourceIdentity,
});

export const starterCatalog = entries.map((entry) => {
  const mapped = (labels) => [
    ...new Set(labels.map((label) => sourceMuscles[label]).filter(Boolean)),
  ];
  const primary = mapped(entry.primaryMuscles);
  const secondary = mapped(entry.secondaryMuscles).filter(
    (muscle) => !primary.includes(muscle),
  );
  const unmapped = [
    ...new Set(
      [...entry.primaryMuscles, ...entry.secondaryMuscles].filter(
        (label) => sourceMuscles[label] === null,
      ),
    ),
  ];
  const keys =
    entry.category === "cardio"
      ? ["duration", "distance"]
      : entry.equipment === "body only"
        ? ["repetitions"]
        : ["repetitions", "load"];
  const metrics = keys.map((key) => {
    const { version: _version, ...metric } = defaultMetrics[key];
    return {
      ...metric,
      ...(key === "load" && entry.equipment === "dumbbell"
        ? { loadMeaning: "per-dumbbell" }
        : {}),
    };
  });
  return {
    sourceId: entry.id,
    original: entry,
    unmapped: unmapped.length
      ? `Region unset: ${unmapped.join(", ")}.`
      : "",
    value: {
      name: entry.name,
      category: entry.category,
      equipment: entry.equipment,
      muscles: { primary, secondary },
      metrics,
      instructions: "",
      archived: false,
    },
  };
});

export const catalogSelectionSchema = object({
  sourceId: text(200, 1),
  exerciseId: reference,
  source: text(200, 1),
  commit: text(40, 40),
  license: text(100, 1),
  mappingVersion: integer(1, 1),
  original: originalSchema,
});
export const catalogSelectionTable = {
  name: "catalog-selection",
  schema: catalogSelectionSchema,
  schemaVersion: 1,
  retention: "until-owner-purge",
  references: [
    { field: "exerciseId", table: "exercise", onDelete: "restrict" },
  ],
  indexes: [
    { fields: ["sourceId"], unique: true },
    { fields: ["exerciseId"], unique: true },
  ],
};

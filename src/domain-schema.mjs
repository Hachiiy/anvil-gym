import {
  choice,
  flag,
  integer,
  list,
  object,
  reference,
  text,
} from "./schema.mjs";
import { measurements, metricSnapshot } from "./metric-schema.mjs";

export const muscles = [
  "chest",
  "front-delts",
  "side-delts",
  "rear-delts",
  "triceps",
  "biceps",
  "forearms",
  "lats",
  "upper-back",
  "lower-back",
  "abs",
  "obliques",
  "glutes",
  "quadriceps",
  "hamstrings",
  "calves",
  "adductors",
  "abductors",
];
export const muscleRoles = object({
  primary: list(choice(...muscles), muscles.length),
  secondary: list(choice(...muscles), muscles.length),
});
export const exerciseSnapshot = object({
  exerciseId: reference,
  exerciseRevision: { type: "integer" },
  name: text(120, 1),
  equipment: text(100),
  muscles: muscleRoles,
  metrics: metricSnapshot,
});
export const plannedSet = object({
  kind: choice("warmup", "working", "drop"),
  values: measurements,
});
export const routineOccurrence = object({
  exerciseId: reference,
  snapshot: exerciseSnapshot,
  // Each occurrence is distinct, even when exerciseId is repeated.
  key: reference,
  sets: list(plannedSet, 20, 1),
  restSeconds: integer(0, 3600),
  notes: text(1000),
});
export const routineBlock = object({
  key: reference,
  kind: choice("single", "superset", "circuit"),
  rounds: integer(1, 100),
  occurrences: list(routineOccurrence, 12, 1),
});
export const recordReference = object({
  id: reference,
  revision: { type: "integer" },
});
export const removalRecords = object({
  sets: list(list(recordReference, 10), 50),
  occurrences: list(recordReference, 50),
  blocks: list(recordReference, 50),
  sessions: list(recordReference, 1),
});

export const recordSchemas = {
  exercise: object({
    name: text(120, 1),
    category: choice("strength", "cardio", "custom"),
    equipment: text(100),
    muscles: muscleRoles,
    metrics: metricSnapshot,
    instructions: text(4000),
    archived: flag,
  }),
  routine: object({
    name: text(120, 1),
    notes: text(2000),
    blocks: list(routineBlock, 30),
    archived: flag,
  }),
  session: object(
    {
      title: text(120, 1),
      startedAt: text(64),
      timeZone: text(100),
      dateKey: text(10, 10),
      status: choice("active", "completed", "abandoned"),
      notes: text(2000),
      sourceKind: choice("free", "routine", "history", "import"),
      sourceId: reference,
      endedAt: text(64),
    },
    [
      "title",
      "startedAt",
      "timeZone",
      "dateKey",
      "status",
      "notes",
      "sourceKind",
    ],
  ),
  block: object({
    sessionId: reference,
    position: integer(0, 1000000),
    kind: choice("single", "superset", "circuit"),
    rounds: integer(1, 100),
    notes: text(1000),
  }),
  occurrence: object({
    sessionId: reference,
    blockId: reference,
    position: integer(0, 1000000),
    snapshot: exerciseSnapshot,
    restSeconds: integer(0, 3600),
    notes: text(1000),
  }),
  set: object(
    {
      occurrenceId: reference,
      sessionId: reference,
      position: integer(0, 1000000),
      round: integer(1, 100),
      kind: choice("warmup", "working", "drop"),
      planned: measurements,
      actual: measurements,
      completed: flag,
      completedAt: text(64),
      notes: text(1000),
    },
    [
      "occurrenceId",
      "sessionId",
      "position",
      "round",
      "kind",
      "planned",
      "actual",
      "completed",
      "notes",
    ],
  ),
  removal: object({
    label: text(120),
    ordinal: integer(0, 1000001),
    scope: choice("set", "occurrence", "block", "session"),
    contextId: reference,
    contextRevision: { type: "integer" },
    sessionId: reference,
    records: removalRecords,
    remaining: list(recordReference, 50),
    remainingOccurrences: list(recordReference, 50),
    remainingBlocks: list(recordReference, 50),
    status: choice(
      "preparing",
      "available",
      "restoring",
      "applied",
      "dismissed",
    ),
    createdAt: text(64),
  }),
};

const references = {
  block: [{ field: "sessionId", table: "session", onDelete: "restrict" }],
  occurrence: [
    { field: "sessionId", table: "session", onDelete: "restrict" },
    { field: "blockId", table: "block", onDelete: "restrict" },
  ],
  set: [
    { field: "sessionId", table: "session", onDelete: "restrict" },
    { field: "occurrenceId", table: "occurrence", onDelete: "restrict" },
  ],
};
const indexes = {
  exercise: ["archived"],
  routine: ["archived"],
  session: ["status", "dateKey"],
  block: ["sessionId"],
  occurrence: ["sessionId", "blockId"],
  set: ["sessionId", "occurrenceId"],
  // Removal metadata names retained tombstones, not live foreign keys.
  removal: ["contextId", "status", "createdAt"],
};
export const tables = Object.entries(recordSchemas).map(([name, schema]) => ({
  name,
  schema,
  schemaVersion: 1,
  retention: "until-owner-purge",
  references: references[name] ?? [],
  indexes: indexes[name].map((field) => ({ fields: [field], unique: false })),
}));

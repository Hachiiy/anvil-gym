import { recordSchemas, muscles, muscleRoles } from "./domain-schema.mjs";
import { authoredMetrics } from "./metric-schema.mjs";
import {
  choice,
  flag,
  integer,
  list,
  object,
  reference,
  text,
} from "./schema.mjs";
import {
  assertion,
  batch,
  binary,
  equal,
  fields,
  filtered,
  input,
  invoke,
  item,
  length,
  literal,
  readAction,
  result,
} from "./expressions.mjs";

const dataSchema = recordSchemas.exercise;
const authoredExercise = object({
  ...dataSchema.properties,
  metrics: authoredMetrics,
});
const rowSchema = object({
  id: reference,
  revision: { type: "integer" },
  data: dataSchema,
});
const capability = (access) => `data.exercise.${access}`;
const valid = object({ valid: flag });
const validValue = fields({ valid: literal(true) });
const roles = ["primary", "secondary"];

export const validateMuscleRole = readAction(
  "validate-muscle-role",
  "Validate a muscle's unique association with an exercise",
  object({ muscle: choice(...muscles), muscles: muscleRoles }),
  [
    assertion(
      "unique-role",
      binary(
        "less",
        binary(
          "add",
          ...roles.map((role) =>
            length(
              filtered(
                input("muscles", role),
                equal(item(), input("muscle")),
                muscles.length,
              ),
            ),
          ),
        ),
        literal(2),
      ),
      "A muscle cannot be duplicated or have both primary and secondary roles.",
    ),
  ],
  valid,
  validValue,
);

export const validateExercise = readAction(
  "validate-exercise",
  "Check unique metric keys and nonoverlapping muscle roles",
  dataSchema,
  [
    batch(
      "metrics",
      "validate-metric-definition",
      input("metrics"),
      fields({
        definition: item(),
        definitions: input("metrics"),
      }),
    ),
    ...roles.map((role) =>
      batch(
        `muscles-${role}`,
        "validate-muscle-role",
        input("muscles", role),
        fields({ muscle: item(), muscles: input("muscles") }),
        muscles.length,
      ),
    ),
  ],
  valid,
  validValue,
);

function normalization(previous, nextVersion) {
  return batch(
    "normalized",
    "normalize-metric-version",
    input("value", "metrics"),
    fields({
      definition: item(),
      previous,
      nextVersion,
    }),
  );
}
const normalizedValue = fields(
  Object.fromEntries(
    Object.keys(dataSchema.properties).map((key) => [
      key,
      key === "metrics" ? result("normalized", "results") : input("value", key),
    ]),
  ),
);
function writeAction(name, updating) {
  return {
    name,
    summary: updating
      ? "Revise an exercise without rewriting past workout snapshots"
      : "Create a custom exercise with explicit measurement meanings",
    effect: "transaction",
    capabilities: updating
      ? [capability("read"), capability("write")]
      : [capability("write")],
    inputSchema: object({
      value: authoredExercise,
      ...(updating ? { id: reference, revision: integer(1, 999999999) } : {}),
    }),
    resultSchema: rowSchema,
    recipe: {
      version: 1,
      steps: [
        ...(updating
          ? [
              {
                id: "previous",
                op: "get",
                table: "exercise",
                recordId: input("id"),
              },
            ]
          : []),
        normalization(
          updating ? result("previous", "data", "metrics") : literal([]),
          updating ? binary("add", input("revision"), literal(1)) : literal(1),
        ),
        { id: "value", op: "let", value: normalizedValue },
        invoke("valid", "validate-exercise", result("value")),
        updating
          ? {
              id: "saved",
              op: "update",
              table: "exercise",
              recordId: input("id"),
              revision: input("revision"),
              value: result("value"),
            }
          : {
              id: "saved",
              op: "create",
              table: "exercise",
              recordId: { op: "id" },
              value: result("value"),
            },
      ],
      result: result("saved"),
    },
  };
}

export const exerciseActions = [
  validateMuscleRole,
  validateExercise,
  writeAction("create-exercise", false),
  writeAction("update-exercise", true),
  {
    ...readAction(
      "get-exercise",
      "Read an exercise including its current measurement definitions",
      object({ id: reference }),
      [{ id: "exercise", op: "get", table: "exercise", recordId: input("id") }],
      rowSchema,
      result("exercise"),
    ),
    capabilities: [capability("read")],
  },
  ...[false, true].map((next) => ({
    ...readAction(
      next ? "next-exercises" : "list-exercises",
      "List exercise definitions, including custom exercises",
      object({ archived: flag, ...(next ? { cursor: text(16000, 1) } : {}) }),
      [
        {
          id: "page",
          op: "query",
          table: "exercise",
          where: [
            { field: ["archived"], compare: "eq", value: input("archived") },
          ],
          order: [{ field: ["name"], direction: "asc" }],
          limit: 50,
          ...(next ? { cursor: input("cursor") } : {}),
        },
      ],
      object({ records: list(rowSchema, 50), nextCursor: text(65536) }, [
        "records",
      ]),
      result("page"),
    ),
    capabilities: [capability("read")],
  })),
];

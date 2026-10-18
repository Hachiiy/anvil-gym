import { recordSchemas } from "../domain-schema.mjs";
import { object, reference } from "../schema.mjs";
import {
  assertion,
  batch,
  binary,
  fields,
  input,
  item,
  length,
  literal,
  readAction,
  result,
} from "../expressions.mjs";
import {
  activeSession,
  appendPosition,
  create,
  entityInput,
  get,
  pageSchema,
  query,
  readCaps,
  rowSchema,
  writeCaps,
} from "./shared.mjs";

export const workoutExerciseActions = [
  {
    name: "add-workout-exercise",
    summary:
      "Add a distinct exercise occurrence with a pinned snapshot and starter sets",
    effect: "transaction",
    capabilities: [
      ...readCaps("session", "exercise", "block", "occurrence", "set"),
      ...writeCaps("block", "occurrence", "set"),
    ],
    inputSchema: object({ sessionId: reference, exerciseId: reference }),
    resultSchema: rowSchema("occurrence"),
    recipe: {
      version: 1,
      steps: [
        get("session", "session", input("sessionId")),
        activeSession(),
        get("exercise", "exercise", input("exerciseId")),
        assertion(
          "active-exercise",
          { op: "not", value: result("exercise", "data", "archived") },
          "Choose an exercise that has not been archived.",
        ),
        {
          ...query(
            "previous",
            "occurrence",
            "sessionId",
            result("session", "id"),
            50,
          ),
          order: [{ field: ["position"], direction: "desc" }],
        },
        {
          ...query("blocks", "block", "sessionId", result("session", "id"), 50),
          order: [{ field: ["position"], direction: "desc" }],
        },
        assertion(
          "occurrence-budget",
          binary("less", length(result("previous", "records")), literal(50)),
          "This workout already has 50 exercise occurrences.",
        ),
        assertion(
          "block-budget",
          binary("less", length(result("blocks", "records")), literal(50)),
          "Remove an empty group before adding another exercise.",
        ),
        create(
          "block",
          "block",
          fields({
            sessionId: result("session", "id"),
            position: appendPosition("blocks"),
            kind: literal("single"),
            rounds: literal(1),
            notes: literal(""),
          }),
        ),
        create(
          "saved",
          "occurrence",
          fields({
            sessionId: result("session", "id"),
            blockId: result("block", "id"),
            position: {
              op: "check-number",
              minimum: 0,
              maximum: 1000000,
              integer: true,
              value: binary(
                "add",
                binary(
                  "multiply",
                  result("block", "data", "position"),
                  literal(50),
                ),
                length(result("previous", "records")),
              ),
            },
            snapshot: fields({
              exerciseId: result("exercise", "id"),
              exerciseRevision: result("exercise", "revision"),
              name: result("exercise", "data", "name"),
              equipment: result("exercise", "data", "equipment"),
              muscles: result("exercise", "data", "muscles"),
              metrics: result("exercise", "data", "metrics"),
            }),
            restSeconds: literal(90),
            notes: literal(""),
          }),
        ),
        batch(
          "starter-sets",
          "add-workout-set",
          {
            op: "if",
            condition: {
              op: "equal",
              left: result("exercise", "data", "category"),
              right: literal("cardio"),
            },
            then: literal([0]),
            else: literal([0, 1, 2]),
          },
          fields({ occurrenceId: result("saved", "id") }),
          3,
        ),
      ],
      result: result("saved"),
    },
  },
  {
    ...readAction(
      "get-workout-exercise",
      "Read the exercise snapshot pinned to this workout occurrence",
      entityInput,
      [get("occurrence", "occurrence", input("id"))],
      rowSchema("occurrence"),
      result("occurrence"),
    ),
    capabilities: readCaps("occurrence"),
  },
  {
    ...readAction(
      "list-workout-exercises",
      "List a workout's distinct exercise occurrences",
      object({ sessionId: reference }),
      [
        get("session", "session", input("sessionId")),
        query("page", "occurrence", "sessionId", input("sessionId")),
      ],
      pageSchema("occurrence"),
      result("page"),
    ),
    capabilities: readCaps("session", "occurrence"),
  },
];

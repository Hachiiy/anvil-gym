import { recordSchemas, routineBlock } from "../domain-schema.mjs";
import { flag, object, reference, text } from "../schema.mjs";
import {
  assertion,
  batch,
  equal,
  fields,
  input,
  item,
  literal,
  mapped,
  readAction,
  result,
} from "../expressions.mjs";
import {
  create,
  entityInput,
  get,
  pageSchema,
  readCaps,
  rowSchema,
  update,
  writeCaps,
} from "../workouts/shared.mjs";

export const routineActions = [
  {
    ...readAction(
      "prepare-routine-block",
      "Prepare an editable block with pinned measurements",
      object({ exerciseId: reference }),
      [
        get("exercise", "exercise", input("exerciseId")),
        assertion(
          "active-exercise",
          {
            op: "not",
            value: result("exercise", "data", "archived"),
          },
          "Choose an exercise that has not been archived.",
        ),
      ],
      routineBlock,
      fields({
        key: { op: "id" },
        kind: literal("single"),
        rounds: literal(1),
        occurrences: {
          op: "array",
          items: [
            fields({
              exerciseId: input("exerciseId"),
              key: { op: "id" },
              snapshot: fields({
                exerciseId: input("exerciseId"),
                exerciseRevision: result("exercise", "revision"),
                ...Object.fromEntries(
                  ["name", "equipment", "muscles", "metrics"].map((key) => [
                    key,
                    result("exercise", "data", key),
                  ]),
                ),
              }),
              sets: {
                op: "if",
                condition: equal(
                  result("exercise", "data", "category"),
                  literal("cardio"),
                ),
                then: literal([{ kind: "working", values: [] }]),
                else: literal(
                  Array.from({ length: 3 }, () => ({
                    kind: "working",
                    values: [],
                  })),
                ),
              },
              restSeconds: literal(90),
              notes: literal(""),
            }),
          ],
        },
      }),
    ),
    capabilities: readCaps("exercise"),
  },
  {
    name: "create-routine",
    summary: "Create a reusable routine",
    effect: "transaction",
    capabilities: writeCaps("routine"),
    inputSchema: object({ name: text(120, 1) }),
    resultSchema: rowSchema("routine"),
    recipe: {
      version: 1,
      steps: [
        create(
          "saved",
          "routine",
          fields({
            name: input("name"),
            notes: literal(""),
            blocks: literal([]),
            archived: literal(false),
          }),
        ),
      ],
      result: result("saved"),
    },
  },
  {
    ...readAction(
      "get-routine",
      "Read a reusable routine",
      entityInput,
      [get("routine", "routine", input("id"))],
      rowSchema("routine"),
      result("routine"),
    ),
    capabilities: readCaps("routine"),
  },
  {
    ...readAction(
      "list-routines",
      "List reusable routines",
      object({ archived: flag }),
      [
        {
          id: "page",
          op: "query",
          table: "routine",
          where: [
            { field: ["archived"], compare: "eq", value: input("archived") },
          ],
          order: [{ field: ["name"], direction: "asc" }],
          limit: 50,
        },
      ],
      pageSchema("routine"),
      result("page"),
    ),
    capabilities: readCaps("routine"),
  },
  {
    name: "revise-routine",
    summary: "Revise a routine without rewriting started workouts",
    effect: "transaction",
    capabilities: [...readCaps("routine"), ...writeCaps("routine")],
    inputSchema: object({
      id: reference,
      revision: { type: "integer" },
      value: recordSchemas.routine,
    }),
    resultSchema: rowSchema("routine"),
    recipe: {
      version: 1,
      steps: [
        get("routine", "routine", input("id")),
        batch(
          "blocks",
          "validate-routine-block",
          input("value", "blocks"),
          fields({
            block: item(),
            keys: mapped(input("value", "blocks"), item("key"), 30),
          }),
          30,
        ),
        update(
          "saved",
          "routine",
          input("id"),
          input("revision"),
          input("value"),
        ),
      ],
      result: result("saved"),
    },
  },
];

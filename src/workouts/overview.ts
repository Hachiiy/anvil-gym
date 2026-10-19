import type { AppExpression } from "@anvil/app-sdk/author";
import { integer, list, object, reference, text } from "../schema.mjs";
import {
  all,
  batch,
  binary,
  conditional,
  equal,
  fields,
  filtered,
  input,
  invoke,
  item,
  length,
  literal,
  mapped,
  readAction,
  result,
} from "../expressions.mjs";
import { workoutOutlineActions } from "./outline.mjs";
import { loggingActions } from "./logging.mjs";
import { setEditSchema } from "./sets.mjs";
import { readCaps, writeCaps } from "./shared.mjs";

export const overviewPageSize = 6;
const outlineSchema = workoutOutlineActions.find(
  (action) => action.name === "list-workout-outline",
)!.resultSchema.properties!.records!.items!;
const edits = list(setEditSchema, 10);
const at = (source: AppExpression, index: AppExpression): AppExpression => ({
  op: "at",
  source,
  index,
});
const sum = (field: "sets" | "completed") => ({
  op: "check-number",
  minimum: 0,
  maximum: 500,
  integer: true,
  value: {
    op: "sum",
    source: result("outline", "records"),
    value: item(field),
    maxItems: 50,
  },
});

export const overviewActions = [
  {
    ...readAction(
      "get-workout-card",
      "Read a present exercise card; an empty slot has no records",
      object({ ids: list(reference, 1) }),
      [
        batch(
          "card",
          "get-workout-logging",
          input("ids"),
          fields({ id: item() }),
          1,
        ),
      ],
      {
        ...loggingActions.find(
          (action) => action.name === "get-workout-logging",
        )!.resultSchema,
        required: ["records", "sets", "ordinals"],
      },
      conditional(
        binary("greater", length(result("card", "results")), literal(0)),
        at(result("card", "results"), literal(0)),
        literal({
          records: [],
          sets: [],
          ordinals: Array.from({ length: 10 }, (_, i) => i + 1),
        }),
      ),
    ),
    capabilities: readCaps("occurrence", "block", "set"),
  },
  {
    ...readAction(
      "get-workout-page",
      "Read six ordered exercise cards and whole-workout completion counts",
      object({ sessionId: reference, page: integer(0, 8) }),
      [
        invoke(
          "outline",
          "list-workout-outline",
          fields({ sessionId: input("sessionId") }),
        ),
        {
          id: "indices",
          op: "let",
          value: filtered(
            literal(Array.from({ length: 50 }, (_, index) => index)),
            all(
              binary("less", item(), length(result("outline", "records"))),
              {
                op: "not",
                value: binary(
                  "less",
                  item(),
                  binary("multiply", input("page"), literal(overviewPageSize)),
                ),
              },
              binary(
                "less",
                item(),
                binary(
                  "multiply",
                  binary("add", input("page"), literal(1)),
                  literal(overviewPageSize),
                ),
              ),
            ),
            50,
          ),
        },
      ],
      object({
        records: list(outlineSchema, overviewPageSize),
        slots: list(
          object({ ids: list(reference, 1) }),
          overviewPageSize,
          overviewPageSize,
        ),
        previousPage: integer(0, 8),
        nextPage: integer(0, 8),
        total: integer(0, 50),
        sets: integer(0, 500),
        completed: integer(0, 500),
      }),
      fields({
        records: mapped(
          result("indices"),
          at(result("outline", "records"), item()),
          overviewPageSize,
        ),
        slots: mapped(
          literal(
            Array.from({ length: overviewPageSize }, (_, index) => index),
          ),
          fields({
            ids: conditional(
              binary("less", item(), length(result("indices"))),
              {
                op: "array",
                items: [
                  {
                    op: "at",
                    source: {
                      op: "map",
                      source: result("outline", "records"),
                      value: item("id"),
                      maxItems: 50,
                    },
                    index: {
                      op: "at",
                      source: result("indices"),
                      index: item(),
                    },
                  },
                ],
              },
              literal([]),
            ),
          }),
          overviewPageSize,
        ),
        previousPage: {
          op: "check-number",
          minimum: 0,
          maximum: 8,
          integer: true,
          value: conditional(
            equal(input("page"), literal(0)),
            literal(0),
            binary("subtract", input("page"), literal(1)),
          ),
        },
        nextPage: {
          op: "check-number",
          minimum: 0,
          maximum: 8,
          integer: true,
          value: conditional(
            equal(input("page"), literal(8)),
            literal(8),
            binary("add", input("page"), literal(1)),
          ),
        },
        total: length(result("outline", "records")),
        sets: sum("sets"),
        completed: sum("completed"),
      }),
    ),
    capabilities: readCaps("session", "occurrence", "block", "set"),
  },
  {
    name: "record-workout-card",
    summary:
      "Save one visible exercise card; an unused empty card performs no mutation",
    effect: "transaction",
    capabilities: [...readCaps("occurrence", "set"), ...writeCaps("set")],
    inputSchema: object({ occurrenceId: reference, sets: edits }, ["sets"]),
    resultSchema: object({ sets: edits }),
    recipe: {
      version: 1,
      steps: [
        batch(
          "saved",
          "record-occurrence-set",
          input("sets"),
          fields({
            occurrenceId: input("occurrenceId"),
            ...Object.fromEntries(
              Object.keys(setEditSchema.properties).map((key) => [
                key,
                item(key),
              ]),
            ),
          }),
          10,
        ),
      ],
      result: fields({ sets: result("saved", "results") }),
    },
  },
];

export const loggingSchema = loggingActions.find(
  (action) => action.name === "get-workout-logging",
)!.resultSchema;

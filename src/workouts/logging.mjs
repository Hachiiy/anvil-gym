import { measurements, metricSnapshot } from "../metric-schema.mjs";
import { integer, list, object, reference } from "../schema.mjs";
import {
  assertion,
  any,
  batch,
  conditional,
  equal,
  fields,
  input,
  item,
  literal,
  not,
  readAction,
  result,
} from "../expressions.mjs";
import { actualValues, setEditSchema } from "./sets.mjs";
import {
  entityInput,
  get,
  query,
  readCaps,
  rowSchema,
  writeCaps,
} from "./shared.mjs";

const edits = list(setEditSchema, 10);
const editorSchema = object({
  draft: setEditSchema,
  targets: measurements,
});
const setFields = Object.fromEntries(
  Object.keys(setEditSchema.properties).map((key) => [key, input(key)]),
);
const prepareInput = (row) =>
  fields({
    set: row,
    definitions: result("exercise", "data", "snapshot", "metrics"),
  });

export const loggingActions = [
  readAction(
    "prepare-logging-set",
    "Prepare editable actuals without copying targets into performed values",
    object({ set: rowSchema("set"), definitions: metricSnapshot }),
    [
      batch(
        "values",
        "prepare-set-measurement",
        input("definitions"),
        fields({ definition: item(), values: input("set", "data", "actual") }),
      ),
    ],
    editorSchema,
    fields({
      draft: fields({
        id: input("set", "id"),
        revision: input("set", "revision"),
        values: result("values", "results"),
        completed: input("set", "data", "completed"),
        kind: input("set", "data", "kind"),
        notes: input("set", "data", "notes"),
      }),
      targets: input("set", "data", "planned"),
    }),
  ),
  {
    ...readAction(
      "get-workout-logging",
      "Read one focused exercise, its group and all ten bounded editable set rows",
      entityInput,
      [
        get("exercise", "occurrence", input("id")),
        get("block", "block", result("exercise", "data", "blockId")),
        query("sets", "set", "occurrenceId", input("id"), 10),
        batch(
          "drafts",
          "prepare-logging-set",
          result("sets", "records"),
          prepareInput(item()),
          10,
        ),
      ],
      object({
        exercise: rowSchema("occurrence"),
        block: rowSchema("block"),
        records: list(rowSchema("set"), 10),
        sets: list(editorSchema, 10),
        ordinals: list(integer(1, 10), 10, 10),
      }),
      fields({
        exercise: result("exercise"),
        block: result("block"),
        records: result("sets", "records"),
        sets: result("drafts", "results"),
        ordinals: literal(Array.from({ length: 10 }, (_, index) => index + 1)),
      }),
    ),
    capabilities: readCaps("occurrence", "block", "set"),
  },
  {
    name: "record-occurrence-set",
    summary: "Record a set only within the requested exercise occurrence",
    effect: "transaction",
    capabilities: [...readCaps("set", "occurrence"), ...writeCaps("set")],
    inputSchema: object({
      ...setEditSchema.properties,
      occurrenceId: reference,
    }),
    resultSchema: setEditSchema,
    recipe: {
      version: 1,
      steps: [
        get("set", "set", input("id")),
        assertion(
          "same-occurrence",
          equal(result("set", "data", "occurrenceId"), input("occurrenceId")),
          "This set belongs to another exercise occurrence.",
        ),
        {
          id: "changed",
          op: "let",
          value: any(
            not(equal(actualValues, result("set", "data", "actual"))),
            ...["completed", "kind", "notes"].map((key) =>
              not(equal(input(key), result("set", "data", key))),
            ),
          ),
        },
        batch(
          "saved",
          "record-workout-set",
          conditional(result("changed"), literal([0]), literal([])),
          fields(setFields),
          1,
        ),
        {
          id: "current",
          op: "let",
          value: conditional(
            result("changed"),
            { op: "at", source: result("saved", "results"), index: literal(0) },
            result("set"),
          ),
        },
      ],
      result: fields({ ...setFields, revision: result("current", "revision") }),
    },
  },
  {
    name: "record-workout-logging",
    summary:
      "Autosave a focused exercise's bounded set rows atomically with their exact revisions",
    effect: "transaction",
    capabilities: [...readCaps("set", "occurrence"), ...writeCaps("set")],
    inputSchema: object({ occurrenceId: reference, sets: edits }),
    resultSchema: object({ sets: edits }),
    recipe: {
      version: 1,
      steps: [
        get("exercise", "occurrence", input("occurrenceId")),
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
      result: fields({
        sets: result("saved", "results"),
      }),
    },
  },
];

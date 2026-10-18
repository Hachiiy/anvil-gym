import { recordSchemas } from "../domain-schema.mjs";
import { measuredValue, metricSnapshot } from "../metric-schema.mjs";
import { flag, list, object, reference, text } from "../schema.mjs";
import {
  assertion,
  batch,
  binary,
  equal,
  fields,
  filtered,
  input,
  item,
  length,
  literal,
  mapped,
  readAction,
  result,
} from "../expressions.mjs";
import {
  activeSession,
  create,
  entityInput,
  get,
  pageSchema,
  query,
  readCaps,
  rowSchema,
  update,
  writeCaps,
} from "./shared.mjs";

export const draftMeasurement = object(measuredValue.properties, [
  "key",
  "unit",
]);
export const draftMeasurements = list(draftMeasurement, 12);
export const setEditSchema = object({
  id: reference,
  revision: { type: "integer" },
  values: draftMeasurements,
  completed: flag,
  kind: recordSchemas.set.properties.kind,
  notes: text(1000),
});
const draftValue = fields({
  key: input("definition", "key"),
  unit: input("definition", "unit"),
});
export const actualValues = mapped(
  filtered(input("values"), { op: "has", source: item(), path: ["value"] }),
  fields({
    key: item("key"),
    unit: item("unit"),
    value: { op: "coalesce", left: item("value"), right: literal(0) },
  }),
);

export const setActions = [
  readAction(
    "prepare-set-measurement",
    "Prepare one input without inventing an unrecorded value",
    object({
      definition: metricSnapshot.items,
      values: recordSchemas.set.properties.actual,
    }),
    [
      {
        id: "matching",
        op: "let",
        value: filtered(
          input("values"),
          equal(item("key"), input("definition", "key")),
        ),
      },
    ],
    draftMeasurement,
    {
      op: "if",
      condition: binary("greater", length(result("matching")), literal(0)),
      then: fields({
        ...draftValue.fields,
        value: {
          op: "at",
          source: mapped(result("matching"), item("value")),
          index: literal(0),
        },
      }),
      else: draftValue,
    },
  ),
  {
    name: "add-workout-set",
    summary: "Add an unperformed set without guessing measurements",
    effect: "transaction",
    capabilities: [
      ...readCaps("occurrence", "session", "set"),
      ...writeCaps("set"),
    ],
    inputSchema: object({ occurrenceId: reference }),
    resultSchema: rowSchema("set"),
    recipe: {
      version: 1,
      steps: [
        get("occurrence", "occurrence", input("occurrenceId")),
        get("session", "session", result("occurrence", "data", "sessionId")),
        activeSession(),
        query("previous", "set", "occurrenceId", input("occurrenceId"), 10),
        assertion(
          "set-budget",
          binary("less", length(result("previous", "records")), literal(10)),
          "This exercise occurrence already has the initial limit of 10 sets.",
        ),
        create(
          "saved",
          "set",
          fields({
            occurrenceId: input("occurrenceId"),
            sessionId: result("occurrence", "data", "sessionId"),
            position: length(result("previous", "records")),
            round: literal(1),
            kind: literal("working"),
            planned: literal([]),
            actual: literal([]),
            completed: literal(false),
            notes: literal(""),
          }),
        ),
      ],
      result: result("saved"),
    },
  },
  {
    ...readAction(
      "list-workout-sets",
      "List sets for one exercise occurrence",
      object({ occurrenceId: reference }),
      [
        get("occurrence", "occurrence", input("occurrenceId")),
        query("page", "set", "occurrenceId", input("occurrenceId"), 10),
      ],
      pageSchema("set", 10),
      result("page"),
    ),
    capabilities: readCaps("occurrence", "set"),
  },
  {
    ...readAction(
      "get-set-editor",
      "Read a set with its pinned metrics and blank inputs for unknown values",
      entityInput,
      [
        get("set", "set", input("id")),
        get("occurrence", "occurrence", result("set", "data", "occurrenceId")),
        batch(
          "drafts",
          "prepare-set-measurement",
          result("occurrence", "data", "snapshot", "metrics"),
          fields({
            definition: item(),
            values: result("set", "data", "actual"),
          }),
        ),
      ],
      object({
        set: rowSchema("set"),
        occurrence: rowSchema("occurrence"),
        values: draftMeasurements,
      }),
      fields({
        set: result("set"),
        occurrence: result("occurrence"),
        values: result("drafts", "results"),
      }),
    ),
    capabilities: readCaps("set", "occurrence"),
  },
  {
    name: "record-workout-set",
    summary:
      "Record or correct actual values against this set's pinned measurement meanings",
    effect: "transaction",
    capabilities: [...readCaps("set", "occurrence"), ...writeCaps("set")],
    inputSchema: setEditSchema,
    resultSchema: rowSchema("set"),
    recipe: {
      version: 1,
      steps: [
        get("set", "set", input("id")),
        get("occurrence", "occurrence", result("set", "data", "occurrenceId")),
        { id: "values", op: "let", value: actualValues },
        batch(
          "valid-values",
          "validate-measurement",
          result("values"),
          fields({
            measurement: item(),
            values: result("values"),
            definitions: result("occurrence", "data", "snapshot", "metrics"),
          }),
        ),
        batch(
          "required-values",
          "validate-required-measurement",
          result("occurrence", "data", "snapshot", "metrics"),
          fields({
            definition: item(),
            values: result("values"),
            enforceRequired: input("completed"),
          }),
        ),
        update("saved", "set", input("id"), input("revision"), {
          op: "if",
          condition: input("completed"),
          then: fields({
            ...setData(),
            completedAt: {
              op: "if",
              condition: {
                op: "has",
                source: result("set", "data"),
                path: ["completedAt"],
              },
              then: result("set", "data", "completedAt"),
              else: { op: "now" },
            },
          }),
          else: fields(setData()),
        }),
      ],
      result: result("saved"),
    },
  },
];

function setData() {
  return {
    occurrenceId: result("set", "data", "occurrenceId"),
    sessionId: result("set", "data", "sessionId"),
    position: result("set", "data", "position"),
    round: result("set", "data", "round"),
    planned: result("set", "data", "planned"),
    actual: result("values"),
    kind: input("kind"),
    completed: input("completed"),
    notes: input("notes"),
  };
}

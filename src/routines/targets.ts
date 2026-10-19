import type { AppExpression } from "@anvil/app-sdk/author";
import { plannedSet, routineOccurrence } from "../domain-schema.mjs";
import { metricSnapshot } from "../metric-schema.mjs";
import { flag, list, object, reference, text } from "../schema.mjs";
import {
  all,
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
  mapped,
  readAction,
  result,
} from "../expressions.mjs";
import { actualValues, draftMeasurements } from "../workouts/sets.mjs";
import {
  get,
  readCaps,
  retainedData,
  rowSchema,
  update,
  writeCaps,
} from "../workouts/shared.mjs";

const identity = {
  id: reference,
  blockKey: reference,
  occurrenceKey: reference,
};
const draftSet = object({
  kind: plannedSet.properties.kind,
  values: draftMeasurements,
});
const selected = [
  invoke(
    "block",
    "get-routine-block",
    fields({ id: input("id"), blockKey: input("blockKey") }),
  ),
  {
    id: "matches",
    op: "let",
    value: filtered(
      result("block", "value", "occurrences"),
      equal(item("key"), input("occurrenceKey")),
    ),
  },
  assertion(
    "occurrence",
    equal(length(result("matches")), literal(1)),
    "This exercise is no longer in the routine.",
  ),
  {
    id: "exercise",
    op: "let",
    value: { op: "at", source: result("matches"), index: literal(0) },
  },
];
const occurrenceFields = Object.fromEntries(
  Object.keys(routineOccurrence.properties).map((key) => [key, item(key)]),
);
const sourceCaps = readCaps("routine");

export const routineTargetActions = [
  readAction(
    "prepare-routine-target-set",
    "Prepare editable routine targets without inventing unknown measurements",
    object({ set: plannedSet, definitions: metricSnapshot }),
    [
      batch(
        "values",
        "prepare-set-measurement",
        input("definitions"),
        fields({ definition: item(), values: input("set", "values") }),
      ),
    ],
    draftSet,
    fields({ kind: input("set", "kind"), values: result("values", "results") }),
  ),
  readAction(
    "normalize-routine-target-set",
    "Keep only explicitly recorded routine targets",
    draftSet,
    [],
    plannedSet,
    fields({ kind: input("kind"), values: actualValues }),
  ),
  {
    ...readAction(
      "get-routine-targets",
      "Read targets for one pinned exercise in a routine",
      object(identity),
      [
        ...selected,
        batch(
          "sets",
          "prepare-routine-target-set",
          result("exercise", "sets"),
          fields({
            set: item(),
            definitions: result("exercise", "snapshot", "metrics"),
          }),
          20,
        ),
      ],
      object({
        ...identity,
        revision: { type: "integer" },
        name: text(120, 1),
        definitions: metricSnapshot,
        sets: list(draftSet, 20, 1),
      }),
      fields({
        id: input("id"),
        blockKey: input("blockKey"),
        occurrenceKey: input("occurrenceKey"),
        revision: result("block", "revision"),
        name: result("exercise", "snapshot", "name"),
        definitions: result("exercise", "snapshot", "metrics"),
        sets: result("sets", "results"),
      }),
    ),
    capabilities: sourceCaps,
  },
  {
    name: "record-routine-targets",
    summary:
      "Update only one routine exercise's planned values against its exact revision",
    effect: "transaction",
    capabilities: [...sourceCaps, ...writeCaps("routine")],
    inputSchema: object({
      ...identity,
      revision: { type: "integer" },
      sets: list(draftSet, 20, 1),
    }),
    resultSchema: rowSchema("routine"),
    recipe: {
      version: 1,
      steps: [
        ...selected,
        assertion(
          "set-count",
          equal(length(input("sets")), length(result("exercise", "sets"))),
          "The routine's sets changed. Reload before editing targets.",
        ),
        batch(
          "sets",
          "normalize-routine-target-set",
          input("sets"),
          item(),
          20,
        ),
        batch(
          "valid",
          "validate-routine-set",
          result("sets", "results"),
          fields({
            set: item(),
            definitions: result("exercise", "snapshot", "metrics"),
          }),
          20,
        ),
        get("routine", "routine", input("id")),
        update(
          "saved",
          "routine",
          input("id"),
          input("revision"),
          retainedData("routine", "routine", {
            blocks: mapped(
              result("routine", "data", "blocks"),
              {
                op: "if",
                condition: equal(item("key"), input("blockKey")),
                then: fields({
                  key: item("key"),
                  kind: item("kind"),
                  rounds: item("rounds"),
                  occurrences: mapped(
                    item("occurrences"),
                    fields({
                      ...occurrenceFields,
                      sets: {
                        op: "if",
                        condition: equal(item("key"), input("occurrenceKey")),
                        then: result("sets", "results"),
                        else: item("sets"),
                      },
                    }),
                    12,
                  ),
                }),
                else: item(),
              },
              30,
            ),
          }),
        ),
      ],
      result: result("saved"),
    },
  },
];

const totalRecords: AppExpression = binary("add", literal(1), {
  op: "sum",
  source: result("routine", "data", "blocks"),
  maxItems: 30,
  value: binary(
    "add",
    literal(1),
    binary(
      "add",
      length(item("occurrences")),
      binary("multiply", item("rounds"), {
        op: "sum",
        source: item("occurrences"),
        maxItems: 12,
        value: length(item("sets")),
      }),
    ),
  ),
});
const occurrenceCount: AppExpression = {
  op: "sum",
  source: result("routine", "data", "blocks"),
  maxItems: 30,
  value: length(item("occurrences")),
};

// Each block validates its own round multiplier; aggregate counts stay explicit.
export const routineCapacityActions = [
  readAction(
    "check-routine-block-capacity",
    "Check expanded sets within one workout block",
    object({
      rounds: { type: "integer" },
      occurrences: list(routineOccurrence, 12),
    }),
    [],
    object({ valid: flag }),
    fields({
      valid: equal(
        length(
          filtered(
            input("occurrences"),
            binary(
              "greater",
              binary("multiply", length(item("sets")), input("rounds")),
              literal(10),
            ),
          ),
        ),
        literal(0),
      ),
    }),
  ),
  {
    ...readAction(
      "get-routine-capacity",
      "Explain whether a routine fits the current workout limits",
      object({ id: reference }),
      [
        get("routine", "routine", input("id")),
        batch(
          "blocks",
          "check-routine-block-capacity",
          result("routine", "data", "blocks"),
          fields({ rounds: item("rounds"), occurrences: item("occurrences") }),
          30,
        ),
      ],
      object({ canStart: flag, message: text(200) }),
      fields({
        canStart: all(
          binary(
            "greater",
            length(result("routine", "data", "blocks")),
            literal(0),
          ),
          { op: "not", value: binary("greater", totalRecords, literal(100)) },
          { op: "not", value: binary("greater", occurrenceCount, literal(50)) },
          equal(
            length(
              filtered(
                result("blocks", "results"),
                { op: "not", value: item("valid") },
                30,
              ),
            ),
            literal(0),
          ),
        ),
        message: {
          op: "if",
          condition: equal(
            length(result("routine", "data", "blocks")),
            literal(0),
          ),
          then: literal("Add an exercise to start."),
          else: literal(
            "Use at most 10 expanded sets per exercise and 100 total workout records. Reduce sets, exercises or rounds.",
          ),
        },
      }),
    ),
    capabilities: sourceCaps,
  },
];

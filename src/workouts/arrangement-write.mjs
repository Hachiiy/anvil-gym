import { flag, object, reference } from "../schema.mjs";
import {
  arrangementBlock,
  arrangementOccurrence,
  recordReference,
} from "../domain-schema.mjs";
import {
  all,
  assertion,
  fields,
  binary,
  equal,
  input,
  length,
  literal,
  result,
  readAction,
} from "../expressions.mjs";
import {
  get,
  query,
  readCaps,
  retainedData,
  update,
  writeCaps,
} from "./shared.mjs";
import {
  arrangementContext,
  inverseFields,
  inverseInput,
  inverseResult,
} from "./arrangement-shared.mjs";

const valueSchema = (table) =>
  table === "block" ? arrangementBlock : arrangementOccurrence;
const context = (table) => [
  ...arrangementContext(),
  get("before", table, input("value", "id")),
  assertion(
    "same-workout",
    equal(
      result("before", "data", "sessionId"),
      result("arrangement", "data", "sessionId"),
    ),
    "The record belongs to another workout.",
  ),
  ...(table === "occurrence"
    ? [
        get("parent", "block", input("value", "blockId")),
        assertion(
          "same-parent-workout",
          equal(
            result("parent", "data", "sessionId"),
            result("arrangement", "data", "sessionId"),
          ),
          "Choose a group from this workout.",
        ),
      ]
    : []),
  assertion(
    "observed-record",
    all(
      equal(result("before", "id"), input("value", "id")),
      equal(result("before", "revision"), input("value", "revision")),
    ),
    "The workout structure changed. Reload before organizing it.",
  ),
];
const desired = (table) =>
  retainedData(
    table,
    "before",
    table === "block"
      ? {
          position: input("position"),
          kind: input("value", "kind"),
          rounds: input("value", "rounds"),
          notes: input("value", "notes"),
        }
      : {
          blockId: result("parent", "id"),
          position: {
            op: "check-number",
            minimum: 0,
            maximum: 1000000,
            integer: true,
            value: {
              op: "if",
              condition: input("exact"),
              then: input("position"),
              else: binary(
                "add",
                binary(
                  "multiply",
                  result("parent", "data", "position"),
                  literal(50),
                ),
                input("position"),
              ),
            },
          },
        },
  );
const unchanged = () => equal(result("before", "data"), result("desired"));

export const arrangementWriteActions = [
  {
    ...readAction(
      "validate-arranged-workout-block",
      "Check that a single-exercise block has at most one occurrence",
      object({ id: reference }),
      [
        get("block", "block", input("id")),
        query(
          "occurrences",
          "occurrence",
          "blockId",
          result("block", "id"),
          50,
        ),
        assertion(
          "single-exercise",
          binary(
            "or",
            {
              op: "not",
              value: equal(result("block", "data", "kind"), literal("single")),
            },
            binary(
              "less",
              length(result("occurrences", "records")),
              literal(2),
            ),
          ),
          "Use a superset or circuit for several exercises.",
        ),
      ],
      object({}),
      literal({}),
    ),
    capabilities: readCaps("block", "occurrence"),
  },
  ...["block", "occurrence"].map((table) => ({
    ...readAction(
      `prepare-workout-arrangement-${table}`,
      `Validate one unique observed ${table} and prepare its canonical inverse`,
      inverseInput(valueSchema(table)),
      [...context(table), { id: "desired", op: "let", value: desired(table) }],
      object({ ...inverseResult(table).properties, changed: flag }),
      fields({
        ...inverseFields(table, "before", {
          op: "if",
          condition: unchanged(),
          then: result("before", "revision"),
          else: binary("add", result("before", "revision"), literal(1)),
        }).fields,
        changed: { op: "not", value: unchanged() },
      }),
    ),
    capabilities: readCaps(
      "arrangement",
      table,
      ...(table === "occurrence" ? ["block"] : []),
    ),
  })),
  ...["block", "occurrence"].map((table) => ({
    name: `arrange-workout-${table}`,
    summary: `Change one observed ${table} inside an admitted workout arrangement`,
    effect: "transaction",
    capabilities: [
      ...readCaps(
        "arrangement",
        table,
        ...(table === "occurrence" ? ["block"] : []),
      ),
      ...writeCaps(table),
    ],
    inputSchema: inverseInput(
      table === "block" ? arrangementBlock : arrangementOccurrence,
    ),
    resultSchema: recordReference,
    recipe: {
      version: 1,
      steps: [
        ...context(table),
        { id: "desired", op: "let", value: desired(table) },
        update(
          "saved",
          table,
          input("value", "id"),
          input("value", "revision"),
          result("desired"),
        ),
      ],
      result: fields({
        id: result("saved", "id"),
        revision: result("saved", "revision"),
      }),
    },
  })),
];

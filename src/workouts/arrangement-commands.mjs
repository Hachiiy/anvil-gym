import { recordReference } from "../domain-schema.mjs";
import { object, reference } from "../schema.mjs";
import {
  assertion,
  batch,
  all,
  binary,
  equal,
  fields,
  input,
  item,
  length,
  literal,
  mapped,
  result,
} from "../expressions.mjs";
import { get, query, rowSchema } from "./shared.mjs";
import {
  arrangementCaps,
  at,
  currentRevision,
  indices,
  layoutBlock,
} from "./arrangement-shared.mjs";

const row = (table, read = item) =>
  fields(
    Object.fromEntries(
      (table === "block"
        ? ["id", "revision", "kind", "rounds", "notes"]
        : ["id", "revision", "blockId"]
      ).map((key) => [
        key,
        ["id", "revision"].includes(key) ? read(key) : read("data", key),
      ]),
    ),
  );
const records = () => [
  query("blocks", "block", "sessionId", result("session", "id"), 50),
  query("occurrences", "occurrence", "sessionId", result("session", "id"), 50),
];
const expected = (step, inputKey) =>
  assertion(
    `${step}-revision`,
    equal(result(step, "revision"), input(inputKey, "revision")),
    "This record changed. Reload before arranging it.",
  );
const sameSession = (step) =>
  assertion(
    `${step}-workout`,
    equal(result(step, "data", "sessionId"), result("session", "id")),
    "Choose records from the same workout.",
  );
const finish = (blocks, occurrences) => ({
  id: "arranged",
  op: "invoke",
  action: "arrange-workout",
  input: fields({
    id: result("session", "id"),
    revision: result("session", "revision"),
    blocks,
    occurrences,
  }),
});
const ordinary = (table) =>
  mapped(
    result(table === "block" ? "blocks" : "occurrences", "records"),
    row(table),
    50,
  );
const swapped = (table) =>
  mapped(
    result(table === "block" ? "blocks" : "occurrences", "records"),
    {
      op: "if",
      condition: equal(item("id"), result("first", "id")),
      then: row(table, (...path) => result("second", ...path)),
      else: {
        op: "if",
        condition: equal(item("id"), result("second", "id")),
        then: row(table, (...path) => result("first", ...path)),
        else: row(table),
      },
    },
    50,
  );

export const arrangementCommandActions = [
  ...["block", "occurrence"].map((table) => ({
    name: table === "block" ? "swap-workout-groups" : "swap-workout-exercises",
    summary:
      table === "block"
        ? "Swap two observed workout groups and their real exercise order"
        : "Swap two observed exercises within their workout group",
    effect: "transaction",
    capabilities: arrangementCaps,
    inputSchema: object({
      sessionId: reference,
      revision: { type: "integer" },
      first: recordReference,
      second: recordReference,
    }),
    resultSchema: recordReference,
    recipe: {
      version: 1,
      steps: [
        get("session", "session", input("sessionId")),
        currentRevision("session"),
        get("first", table, input("first", "id")),
        get("second", table, input("second", "id")),
        expected("first", "first"),
        expected("second", "second"),
        sameSession("first"),
        sameSession("second"),
        assertion(
          "distinct-records",
          {
            op: "not",
            value: equal(result("first", "id"), result("second", "id")),
          },
          "Choose two different records.",
        ),
        ...(table === "occurrence"
          ? [
              assertion(
                "same-group",
                equal(
                  result("first", "data", "blockId"),
                  result("second", "data", "blockId"),
                ),
                "Use Move to change an exercise's group.",
              ),
            ]
          : []),
        ...records(),
        finish(
          table === "block" ? swapped("block") : ordinary("block"),
          table === "occurrence"
            ? swapped("occurrence")
            : ordinary("occurrence"),
        ),
      ],
      result: fields({
        id: result("arranged", "id"),
        revision: result("arranged", "revision"),
      }),
    },
  })),
  {
    name: "move-workout-exercise",
    summary:
      "Move an observed exercise and its existing sets to the end of another workout group",
    effect: "transaction",
    capabilities: arrangementCaps,
    inputSchema: object({
      sessionId: reference,
      revision: { type: "integer" },
      occurrence: recordReference,
      block: recordReference,
    }),
    resultSchema: recordReference,
    recipe: {
      version: 1,
      steps: [
        get("session", "session", input("sessionId")),
        currentRevision("session"),
        get("occurrence", "occurrence", input("occurrence", "id")),
        get("block", "block", input("block", "id")),
        expected("occurrence", "occurrence"),
        expected("block", "block"),
        sameSession("occurrence"),
        sameSession("block"),
        assertion(
          "different-group",
          {
            op: "not",
            value: equal(
              result("occurrence", "data", "blockId"),
              result("block", "id"),
            ),
          },
          "This exercise is already in that group.",
        ),
        ...records(),
        {
          id: "preceding",
          order: [{ field: ["position"], direction: "asc" }],
          op: "query",
          table: "occurrence",
          limit: 50,
          where: [
            {
              field: ["sessionId"],
              compare: "eq",
              value: result("session", "id"),
            },
            {
              field: ["position"],
              compare: "lt",
              value: result("occurrence", "data", "position"),
            },
          ],
        },
        {
          id: "moved",
          op: "let",
          value: mapped(
            indices(result("occurrences", "records")),
            at(result("occurrences", "records"), {
              op: "if",
              condition: binary(
                "less",
                item(),
                length(result("preceding", "records")),
              ),
              then: item(),
              else: {
                op: "if",
                condition: equal(
                  item(),
                  binary(
                    "subtract",
                    length(result("occurrences", "records")),
                    literal(1),
                  ),
                ),
                then: length(result("preceding", "records")),
                else: binary("add", item(), literal(1)),
              },
            }),
            50,
          ),
        },
        finish(
          ordinary("block"),
          mapped(
            result("moved"),
            fields({
              ...row("occurrence").fields,
              blockId: {
                op: "if",
                condition: equal(item("id"), result("occurrence", "id")),
                then: result("block", "id"),
                else: item("data", "blockId"),
              },
            }),
            50,
          ),
        ),
      ],
      result: fields({
        id: result("arranged", "id"),
        revision: result("arranged", "revision"),
      }),
    },
  },
  {
    name: "perform-workout-group-configuration",
    summary:
      "Autosave a group's type, rounds and notes without changing performed sets",
    effect: "transaction",
    capabilities: arrangementCaps,
    inputSchema: object(layoutBlock.properties),
    resultSchema: recordReference,
    recipe: {
      version: 1,
      steps: [
        get("block", "block", input("id")),
        currentRevision("block"),
        get("session", "session", result("block", "data", "sessionId")),
        ...records(),
        finish(
          mapped(
            result("blocks", "records"),
            {
              op: "if",
              condition: equal(item("id"), result("block", "id")),
              then: fields({
                id: result("block", "id"),
                revision: result("block", "revision"),
                kind: input("kind"),
                rounds: input("rounds"),
                notes: input("notes"),
              }),
              else: row("block"),
            },
            50,
          ),
          ordinary("occurrence"),
        ),
      ],
      result: fields({
        id: result("arranged", "id"),
        revision: result("arranged", "revision"),
      }),
    },
  },
  {
    name: "configure-workout-group",
    summary:
      "Autosave changed group settings without mutating an unchanged form",
    effect: "transaction",
    capabilities: arrangementCaps,
    inputSchema: object(layoutBlock.properties),
    resultSchema: rowSchema("block"),
    recipe: {
      version: 1,
      steps: [
        get("block", "block", input("id")),
        currentRevision("block"),
        batch(
          "changed",
          "perform-workout-group-configuration",
          {
            op: "if",
            condition: all(
              ...["kind", "rounds", "notes"].map((key) =>
                equal(result("block", "data", key), input(key)),
              ),
            ),
            then: literal([]),
            else: literal([0]),
          },
          fields(
            Object.fromEntries(
              Object.keys(layoutBlock.properties).map((key) => [
                key,
                input(key),
              ]),
            ),
          ),
          1,
        ),
        get("saved", "block", result("block", "id")),
      ],
      result: result("saved"),
    },
  },
];

import { routineBlock } from "../domain-schema.mjs";
import { object, reference } from "../schema.mjs";
import {
  assertion,
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
import {
  get,
  readCaps,
  retainedData,
  rowSchema,
  update,
  writeCaps,
} from "../workouts/shared.mjs";

const identity = { id: reference, blockKey: reference };
const selected = () => [
  get("routine", "routine", input("id")),
  {
    id: "matching",
    op: "let",
    value: filtered(
      result("routine", "data", "blocks"),
      equal(item("key"), input("blockKey")),
      30,
    ),
  },
  assertion(
    "block-found",
    equal(length(result("matching")), literal(1)),
    "This block is unavailable.",
  ),
];

export const routineBlockActions = [
  {
    ...readAction(
      "get-routine-block",
      "Read one block of a reusable routine",
      object(identity),
      selected(),
      object({
        id: reference,
        revision: { type: "integer" },
        blockKey: reference,
        value: routineBlock,
      }),
      fields({
        id: input("id"),
        revision: result("routine", "revision"),
        blockKey: input("blockKey"),
        value: { op: "at", source: result("matching"), index: literal(0) },
      }),
    ),
    capabilities: readCaps("routine"),
  },
  {
    name: "revise-routine-block",
    summary: "Edit one block against the current routine revision",
    effect: "transaction",
    capabilities: [...readCaps("routine"), ...writeCaps("routine")],
    inputSchema: object({
      ...identity,
      revision: { type: "integer" },
      value: routineBlock,
    }),
    resultSchema: rowSchema("routine"),
    recipe: {
      version: 1,
      steps: [
        ...selected(),
        assertion(
          "stable-block",
          equal(input("blockKey"), input("value", "key")),
          "Keep this block's identity.",
        ),
        invoke(
          "valid",
          "validate-routine-block",
          fields({
            block: input("value"),
            keys: mapped(result("routine", "data", "blocks"), item("key"), 30),
          }),
        ),
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
                then: input("value"),
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

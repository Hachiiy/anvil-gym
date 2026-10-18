import { recordReference } from "../domain-schema.mjs";
import { integer, list, object, reference } from "../schema.mjs";
import {
  assertion,
  equal,
  fields,
  input,
  binary,
  filtered,
  item,
  length,
  literal,
  mapped,
  not,
  readAction,
  result,
} from "../expressions.mjs";
import {
  get,
  query,
  readCaps,
  retainedData,
  revisionInput,
  rowSchema,
  update,
  writeCaps,
} from "./shared.mjs";

export const orderActions = [
  {
    ...readAction(
      "get-workout-set-order",
      "Read ordered sets and their current neighbours without requiring contiguous stored positions",
      object({ occurrenceId: reference }),
      [
        get("exercise", "occurrence", input("occurrenceId")),
        query("sets", "set", "occurrenceId", result("exercise", "id"), 10),
        {
          id: "references",
          op: "let",
          value: mapped(
            result("sets", "records"),
            fields({ id: item("id"), revision: item("revision") }),
            10,
          ),
        },
        {
          id: "indices",
          op: "let",
          value: filtered(
            literal(Array.from({ length: 10 }, (_, index) => index)),
            binary("less", item(), length(result("sets", "records"))),
            10,
          ),
        },
      ],
      object({
        exercise: rowSchema("occurrence"),
        records: list(rowSchema("set"), 10),
        previous: list(recordReference, 10),
        next: list(recordReference, 10),
        ordinals: list(integer(1, 10), 10, 10),
      }),
      fields({
        exercise: result("exercise"),
        records: result("sets", "records"),
        ordinals: literal(Array.from({ length: 10 }, (_, index) => index + 1)),
        ...Object.fromEntries(
          ["previous", "next"].map((direction) => [
            direction,
            mapped(
              result("indices"),
              {
                op: "at",
                source: result("references"),
                index: {
                  op: "if",
                  condition:
                    direction === "previous"
                      ? binary("greater", item(), literal(0))
                      : binary(
                          "less",
                          item(),
                          binary(
                            "subtract",
                            length(result("references")),
                            literal(1),
                          ),
                        ),
                  then: binary(
                    direction === "previous" ? "subtract" : "add",
                    item(),
                    literal(1),
                  ),
                  else: item(),
                },
              },
              10,
            ),
          ]),
        ),
      }),
    ),
    capabilities: readCaps("occurrence", "set"),
  },
  {
    name: "swap-workout-sets",
    summary:
      "Swap two sets in one exercise using both observed revisions; swap the returned revisions to undo",
    effect: "transaction",
    capabilities: [...readCaps("set"), ...writeCaps("set")],
    inputSchema: object({
      occurrenceId: reference,
      first: revisionInput,
      second: revisionInput,
    }),
    resultSchema: object({ first: rowSchema("set"), second: rowSchema("set") }),
    recipe: {
      version: 1,
      steps: [
        get("first", "set", input("first", "id")),
        get("second", "set", input("second", "id")),
        assertion(
          "distinct-sets",
          not(equal(input("first", "id"), input("second", "id"))),
          "Choose two different sets.",
        ),
        ...["first", "second"].map((name) =>
          assertion(
            `${name}-occurrence`,
            equal(result(name, "data", "occurrenceId"), input("occurrenceId")),
            "Both sets must belong to this exercise occurrence.",
          ),
        ),
        ...["first", "second"].map((name, index) =>
          update(
            `saved-${name}`,
            "set",
            input(name, "id"),
            input(name, "revision"),
            retainedData("set", name, {
              position: result(index ? "first" : "second", "data", "position"),
            }),
          ),
        ),
      ],
      result: fields({
        first: result("saved-first"),
        second: result("saved-second"),
      }),
    },
  },
];

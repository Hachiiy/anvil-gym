import { object, reference } from "../schema.mjs";
import {
  assertion,
  equal,
  fields,
  input,
  not,
  result,
} from "../expressions.mjs";
import {
  get,
  readCaps,
  retainedData,
  revisionInput,
  rowSchema,
  update,
  writeCaps,
} from "./shared.mjs";

export const orderActions = [
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

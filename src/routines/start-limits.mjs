import {
  assertion,
  binary,
  equal,
  filtered,
  input,
  item,
  length,
  literal,
  result,
} from "../expressions.mjs";

export const totalRecords = binary("add", literal(1), {
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

export const routineOccurrenceLimits = [
  assertion(
    "occurrence-capacity",
    binary("less", length(result("previous", "records")), literal(50)),
    "This workout already has 50 exercises.",
  ),
  assertion(
    "next-routine-occurrence",
    equal(
      length(
        filtered(
          result("previous", "records"),
          equal(item("data", "blockId"), input("blockId")),
          50,
        ),
      ),
      input("occurrencePosition"),
    ),
    "This routine exercise is already present or out of order. Use the workout structure actions.",
  ),
];

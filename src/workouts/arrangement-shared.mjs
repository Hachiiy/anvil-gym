import {
  arrangementBlock,
  arrangementOccurrence,
  recordReference,
} from "../domain-schema.mjs";
import { list, object, reference } from "../schema.mjs";
import {
  assertion,
  binary,
  equal,
  fields,
  filtered,
  input,
  item,
  length,
  literal,
  result,
} from "../expressions.mjs";
import { get, readCaps, writeCaps } from "./shared.mjs";

export const arrangementCaps = [
  ...readCaps("arrangement", "session", "block", "occurrence"),
  ...writeCaps("arrangement", "session", "block", "occurrence"),
];
export const layoutBlock = object(
  Object.fromEntries(
    Object.entries(arrangementBlock.properties).filter(
      ([key]) => key !== "position",
    ),
  ),
);
export const layoutOccurrence = object({
  ...recordReference.properties,
  blockId: reference,
});
export const arrangementInput = object({
  id: reference,
  revision: { type: "integer" },
  blocks: list(layoutBlock, 50),
  occurrences: list(layoutOccurrence, 50),
});
export const at = (source, index) => ({ op: "at", source, index });
export const indices = (source) =>
  filtered(
    literal(Array.from({ length: 50 }, (_, i) => i)),
    binary("less", item(), length(source)),
    50,
  );
export const sameLength = (page, values) =>
  assertion(
    `${page}-count`,
    equal(length(result(page, "records")), length(values)),
    "The workout structure changed. Reload before organizing it.",
  );
export const currentRevision = (step) =>
  assertion(
    "observed-revision",
    equal(result(step, "revision"), input("revision")),
    "This record changed. Reload before continuing.",
  );
export const arrangementContext = () => [
  get("arrangement", "arrangement", input("arrangementId")),
  assertion(
    "arrangement-context",
    binary(
      "or",
      equal(result("arrangement", "data", "status"), literal("preparing")),
      equal(result("arrangement", "data", "status"), literal("restoring")),
    ),
    "Use a workout arrangement action to change its structure.",
  ),
];
export const inverseInput = (schema) =>
  object(
    {
      arrangementId: reference,
      value: object(
        schema.properties,
        Object.keys(schema.properties).filter((key) => key !== "position"),
      ),
      position: schema.properties.position,
      exact: { type: "boolean" },
    },
    ["arrangementId", "value", "position", "exact"],
  );
export const inverseResult = (table) =>
  table === "block" ? arrangementBlock : arrangementOccurrence;
export const inverseFields = (table, row, revision) =>
  fields({
    id: result(row, "id"),
    revision,
    ...Object.fromEntries(
      Object.keys(inverseResult(table).properties)
        .filter((key) => !["id", "revision"].includes(key))
        .map((key) => [key, result(row, "data", key)]),
    ),
  });

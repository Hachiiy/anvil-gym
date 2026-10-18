import { recordReference } from "../domain-schema.mjs";
import { object, reference } from "../schema.mjs";
import {
  assertion,
  binary,
  equal,
  fields,
  input,
  item,
  literal,
  mapped,
  result,
} from "../expressions.mjs";
import { get } from "./shared.mjs";

export const removalInput = object({ removalId: reference });
export const removalRecordInput = object({
  removalId: reference,
  ...recordReference.properties,
});
export const recordReferences = (source, maximum = 50, offset = 0) =>
  mapped(
    source,
    fields({
      id: item("id"),
      revision: offset
        ? binary("add", item("revision"), literal(offset))
        : item("revision"),
    }),
    maximum,
  );
export const removalContext = (status) => [
  get("removal", "removal", input("removalId")),
  assertion(
    "removal-context",
    equal(result("removal", "data", "status"), literal(status)),
    status === "restoring"
      ? "Use Undo removal to restore these records."
      : "Use a removal action to delete these records.",
  ),
];
export const sameSession = (
  source,
  session = result(source, "data", "sessionId"),
) =>
  assertion(
    "same-workout",
    equal(session, result("removal", "data", "sessionId")),
    "The record belongs to another workout.",
  );
export const expectParent = (source) =>
  assertion(
    "same-parent",
    equal(
      result(source, "revision"),
      result("removal", "data", "contextRevision"),
    ),
    "The parent changed. This removal can no longer be undone.",
  );
export const expectCollection = (source, key = "remaining") =>
  assertion(
    `same-${key.replace(/[A-Z]/g, (value) => "-" + value.toLowerCase())}`,
    equal(
      recordReferences(result(source, "records")),
      result("removal", "data", key),
    ),
    "The workout changed. This removal can no longer be undone.",
  );

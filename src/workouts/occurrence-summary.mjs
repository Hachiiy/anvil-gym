import { recordReference } from "../domain-schema.mjs";
import { integer, object, reference, text } from "../schema.mjs";
import { fields, item, mapped, result } from "../expressions.mjs";

// Organization views need identity, membership and a pinned display name.
// Exercise definitions and measurements remain available through logging reads.
export const occurrenceSummary = object({
  ...recordReference.properties,
  data: object({
    blockId: reference,
    position: integer(0, 1000000),
    snapshot: object({ name: text(120, 1) }),
  }),
});
export const occurrenceSummaries = (step) =>
  mapped(
    result(step, "records"),
    fields({
      id: item("id"),
      revision: item("revision"),
      data: fields({
        blockId: item("data", "blockId"),
        position: item("data", "position"),
        snapshot: fields({ name: item("data", "snapshot", "name") }),
      }),
    }),
    50,
  );

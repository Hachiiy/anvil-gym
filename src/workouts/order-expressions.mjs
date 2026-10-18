import { recordReference } from "../domain-schema.mjs";
import { integer, object } from "../schema.mjs";
import {
  binary,
  fields,
  item,
  length,
  literal,
  mapped,
  result,
} from "../expressions.mjs";
import { at, indices } from "./arrangement-shared.mjs";

export const orderEntry = object({
  current: recordReference,
  previous: recordReference,
  next: recordReference,
  ordinal: integer(1, 50),
  total: integer(0, 50),
});
export const orderReferences = (id, page) => ({
  id,
  op: "let",
  value: mapped(
    result(page, "records"),
    fields({ id: item("id"), revision: item("revision") }),
    50,
  ),
});
export const orderedEntries = (step) =>
  mapped(
    indices(result(step)),
    fields({
      current: at(result(step), item()),
      previous: at(result(step), {
        op: "if",
        condition: binary("greater", item(), literal(0)),
        then: binary("subtract", item(), literal(1)),
        else: item(),
      }),
      next: at(result(step), {
        op: "if",
        condition: binary(
          "less",
          item(),
          binary("subtract", length(result(step)), literal(1)),
        ),
        then: binary("add", item(), literal(1)),
        else: item(),
      }),
      ordinal: {
        op: "check-number",
        minimum: 1,
        maximum: 50,
        integer: true,
        value: binary("add", item(), literal(1)),
      },
      total: {
        op: "check-number",
        minimum: 0,
        maximum: 50,
        integer: true,
        value: length(result(step)),
      },
    }),
    50,
  );

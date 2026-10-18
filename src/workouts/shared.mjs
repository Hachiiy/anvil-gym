import { recordSchemas } from "../domain-schema.mjs";
import { object, reference, text } from "../schema.mjs";
import {
  assertion,
  equal,
  fields,
  input,
  literal,
  result,
} from "../expressions.mjs";

export const rowSchema = (table) =>
  object({
    id: reference,
    revision: { type: "integer" },
    data: recordSchemas[table],
  });
export const pageSchema = (table, maximum = 50) =>
  object(
    {
      records: { type: "array", items: rowSchema(table), maxItems: maximum },
      nextCursor: text(65536),
    },
    ["records"],
  );
export const get = (id, table, recordId) => ({
  id,
  op: "get",
  table,
  recordId,
});
export const readCaps = (...tables) =>
  tables.map((table) => `data.${table}.read`);
export const writeCaps = (...tables) =>
  tables.map((table) => `data.${table}.write`);
export const query = (id, table, field, value, limit = 50) => ({
  id,
  op: "query",
  table,
  where: [{ field: [field], compare: "eq", value }],
  order: [{ field: ["position"], direction: "asc" }],
  limit,
});
export const activeSession = (step = "session") =>
  assertion(
    "active-workout",
    equal(result(step, "data", "status"), literal("active")),
    "This workout is no longer active.",
  );
export const create = (id, table, value) => ({
  id,
  op: "create",
  table,
  recordId: { op: "id" },
  value,
});
export const update = (id, table, recordId, revision, value) => ({
  id,
  op: "update",
  table,
  recordId,
  revision,
  value,
});

export function retainedData(table, step, changes) {
  const schema = recordSchemas[table];
  const required = Object.fromEntries(
    schema.required.map((key) => [key, result(step, "data", key)]),
  );
  const optional = Object.keys(schema.properties).filter(
    (key) => !schema.required.includes(key) && !Object.hasOwn(changes, key),
  );
  const finish = (index, values) => {
    const key = optional[index];
    if (!key) return fields({ ...values, ...changes });
    return {
      op: "if",
      condition: { op: "has", source: result(step, "data"), path: [key] },
      then: finish(index + 1, { ...values, [key]: result(step, "data", key) }),
      else: finish(index + 1, values),
    };
  };
  return finish(0, required);
}
export const entityInput = object({ id: reference });
export const revisionInput = object({
  id: reference,
  revision: { type: "integer" },
});
export const inputId = input("id");

export const appendPosition = (step, maximum = 50) => ({
  op: "check-number",
  minimum: 0,
  maximum: 1000000,
  integer: true,
  value: {
    op: "if",
    condition: {
      op: "greater",
      left: { op: "length", value: result(step, "records") },
      right: literal(0),
    },
    then: {
      op: "add",
      left: {
        op: "at",
        source: {
          op: "map",
          source: result(step, "records"),
          value: { op: "item", path: ["data", "position"] },
          maxItems: maximum,
        },
        index: literal(0),
      },
      right: literal(1),
    },
    else: literal(0),
  },
});

export const availablePosition = (step, preferred, maximum = 50) => ({
  op: "if",
  condition: {
    op: "greater",
    left: {
      op: "length",
      value: {
        op: "filter",
        source: result(step, "records"),
        value: {
          op: "equal",
          left: { op: "item", path: ["data", "position"] },
          right: preferred,
        },
        maxItems: maximum,
      },
    },
    right: literal(0),
  },
  then: appendPosition(step, maximum),
  else: preferred,
});

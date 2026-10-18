import { recordReference, recordSchemas } from "./domain-schema.mjs";
import { list, object, text } from "./schema.mjs";
import { fields, item, mapped, result } from "./expressions.mjs";

const columns = {
  exercise: ["name", "category", "equipment", "archived"],
  routine: ["name", "archived"],
  session: [
    "title",
    "startedAt",
    "timeZone",
    "dateKey",
    "status",
    "sourceKind",
  ],
};
export const libraryRow = (table) =>
  object({
    ...recordReference.properties,
    data: object(
      Object.fromEntries(
        columns[table].map((key) => [
          key,
          recordSchemas[table].properties[key],
        ]),
      ),
    ),
  });
export const libraryPage = (table, cursorRequired = false) =>
  object(
    {
      records: list(libraryRow(table), 50),
      nextCursor: text(65536),
    },
    cursorRequired ? ["records", "nextCursor"] : ["records"],
  );
export const libraryRows = (table, step = "page") =>
  mapped(
    result(step, "records"),
    fields({
      id: item("id"),
      revision: item("revision"),
      data: fields(
        Object.fromEntries(
          columns[table].map((key) => [key, item("data", key)]),
        ),
      ),
    }),
    50,
  );
export const libraryRowsStep = (table) => ({
  id: "summary",
  op: "let",
  value: libraryRows(table),
});
export const libraryResult = () => ({
  op: "if",
  condition: { op: "has", source: result("page"), path: ["nextCursor"] },
  then: fields({
    records: result("summary"),
    nextCursor: result("page", "nextCursor"),
  }),
  else: fields({ records: result("summary") }),
});

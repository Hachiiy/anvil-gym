import {
  catalogEntrySchema,
  catalogInput,
  catalogSelectionSchema,
  catalogSource,
  starterCatalog,
} from "./catalog.mjs";
import { list, object, reference } from "./schema.mjs";
import {
  batch,
  conditional,
  equal,
  fields,
  filtered,
  input,
  invoke,
  item,
  length,
  literal,
  readAction,
  result,
} from "./expressions.mjs";
import {
  create,
  get,
  readCaps,
  rowSchema,
  writeCaps,
} from "./workouts/shared.mjs";

const at = (source) => ({ op: "at", source, index: literal(0) });
const selectionRow = object({
  id: reference,
  revision: { type: "integer" },
  data: catalogSelectionSchema,
});
const caps = [
  ...readCaps("exercise", "catalog-selection"),
  ...writeCaps("exercise", "catalog-selection"),
];

export const catalogActions = [
  {
    ...readAction(
      "list-starter-copies",
      "Read which starter entries already have an editable exercise copy",
      object({}),
      [
        {
          id: "copies",
          op: "query",
          table: "catalog-selection",
          where: [],
          order: [],
          limit: 19,
        },
      ],
      object({ records: list(selectionRow, 19) }),
      fields({ records: result("copies", "records") }),
    ),
    capabilities: readCaps("catalog-selection"),
  },
  {
    ...readAction(
      "get-exercise-source",
      "Read retained public catalog provenance for an adapted exercise",
      object({ id: reference }),
      [
        {
          id: "origin",
          op: "query",
          table: "catalog-selection",
          where: [{ field: ["exerciseId"], compare: "eq", value: input("id") }],
          order: [],
          limit: 1,
        },
      ],
      object({ records: list(selectionRow, 1) }),
      fields({ records: result("origin", "records") }),
    ),
    capabilities: readCaps("catalog-selection"),
  },
  readAction(
    "list-starter-exercises",
    "Read the pinned public starter catalog and explicit editable defaults",
    object({}),
    [],
    object({ records: list(catalogEntrySchema, 19, 19) }),
    fields({ records: literal(starterCatalog) }),
  ),
  readAction(
    "get-starter-exercise",
    "Read one starter exercise with its original source labels",
    catalogInput,
    [invoke("catalog", "list-starter-exercises", literal({}))],
    catalogEntrySchema,
    at(
      filtered(
        result("catalog", "records"),
        equal(item("sourceId"), input("sourceId")),
        19,
      ),
    ),
  ),
  {
    name: "import-starter-entry",
    summary: "Create a starter exercise and retain its source provenance",
    effect: "transaction",
    capabilities: caps,
    inputSchema: catalogInput,
    resultSchema: selectionRow,
    recipe: {
      version: 1,
      steps: [
        invoke(
          "entry",
          "get-starter-exercise",
          fields({ sourceId: input("sourceId") }),
        ),
        invoke(
          "exercise",
          "create-exercise",
          fields({ value: result("entry", "value") }),
        ),
        create(
          "selection",
          "catalog-selection",
          fields({
            sourceId: input("sourceId"),
            exerciseId: result("exercise", "id"),
            ...Object.fromEntries(
              Object.entries(catalogSource).map(([key, value]) => [
                key,
                literal(value),
              ]),
            ),
            original: result("entry", "original"),
          }),
        ),
      ],
      result: result("selection"),
    },
  },
  {
    name: "add-starter-exercise",
    summary: "Add a catalog exercise once, or open its existing editable copy",
    effect: "transaction",
    capabilities: caps,
    inputSchema: catalogInput,
    resultSchema: rowSchema("exercise"),
    recipe: {
      version: 1,
      steps: [
        {
          id: "existing",
          op: "query",
          table: "catalog-selection",
          where: [
            { field: ["sourceId"], compare: "eq", value: input("sourceId") },
          ],
          order: [],
          limit: 1,
        },
        batch(
          "added",
          "import-starter-entry",
          conditional(
            equal(length(result("existing", "records")), literal(0)),
            { op: "array", items: [input("sourceId")] },
            literal([]),
          ),
          fields({ sourceId: item() }),
          1,
        ),
        {
          id: "selection",
          op: "let",
          value: at(
            conditional(
              equal(length(result("existing", "records")), literal(0)),
              result("added", "results"),
              result("existing", "records"),
            ),
          ),
        },
        get("exercise", "exercise", result("selection", "data", "exerciseId")),
      ],
      result: result("exercise"),
    },
  },
];

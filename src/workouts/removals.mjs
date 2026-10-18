import { recordReference } from "../domain-schema.mjs";
import { list, object, reference } from "../schema.mjs";
import {
  assertion,
  batch,
  binary,
  equal,
  fields,
  filtered,
  input,
  item,
  literal,
  mapped,
  not,
  oneOf,
  readAction,
  result,
} from "../expressions.mjs";
import {
  create,
  entityInput,
  get,
  pageSchema,
  query,
  readCaps,
  retainedData,
  revisionInput,
  rowSchema,
  update,
  writeCaps,
} from "./shared.mjs";

const references = (source) =>
  mapped(source, fields({ id: item("id"), revision: item("revision") }), 10);
const requireRevision = () =>
  assertion(
    "removal-revision",
    equal(result("removal", "revision"), input("revision")),
    "This removal changed. Reload before continuing.",
  );
const restoreContext = () => [
  get("removal", "removal", input("removalId")),
  assertion(
    "restoring",
    equal(result("removal", "data", "status"), literal("restoring")),
    "Use Undo removal to restore these records.",
  ),
];
const currentSets = () =>
  query(
    "current",
    "set",
    "occurrenceId",
    result("removal", "data", "contextId"),
    10,
  );

export const removalActions = [
  {
    name: "remove-workout-set",
    summary:
      "Remove one observed set and retain a durable revision-checked Undo",
    effect: "transaction",
    capabilities: [
      ...readCaps("set", "occurrence"),
      ...writeCaps("set", "removal"),
    ],
    inputSchema: revisionInput,
    resultSchema: rowSchema("removal"),
    recipe: {
      version: 1,
      steps: [
        get("set", "set", input("id")),
        get("occurrence", "occurrence", result("set", "data", "occurrenceId")),
        query("sets", "set", "occurrenceId", result("occurrence", "id"), 10),
        create(
          "removal",
          "removal",
          fields({
            scope: literal("set"),
            contextId: result("occurrence", "id"),
            contextRevision: result("occurrence", "revision"),
            sessionId: result("set", "data", "sessionId"),
            records: fields({
              sets: {
                op: "array",
                items: [
                  {
                    op: "array",
                    items: [
                      fields({
                        id: result("set", "id"),
                        revision: binary(
                          "add",
                          result("set", "revision"),
                          literal(1),
                        ),
                      }),
                    ],
                  },
                ],
              },
              occurrences: literal([]),
              blocks: literal([]),
              sessions: literal([]),
            }),
            remaining: references(
              filtered(
                result("sets", "records"),
                not(equal(item("id"), result("set", "id"))),
                10,
              ),
            ),
            status: literal("preparing"),
            createdAt: { op: "now" },
          }),
        ),
        {
          id: "deleted",
          op: "delete",
          table: "set",
          recordId: input("id"),
          revision: input("revision"),
        },
        update(
          "available",
          "removal",
          result("removal", "id"),
          result("removal", "revision"),
          retainedData("removal", "removal", { status: literal("available") }),
        ),
      ],
      result: result("available"),
    },
  },
  {
    name: "undo-workout-removal",
    summary:
      "Restore retained set data only while its parent and remaining sets match the removal",
    effect: "transaction",
    capabilities: [
      ...readCaps("removal", "set", "occurrence"),
      ...writeCaps("removal", "set"),
    ],
    inputSchema: revisionInput,
    resultSchema: rowSchema("removal"),
    recipe: {
      version: 1,
      steps: [
        get("removal", "removal", input("id")),
        requireRevision(),
        assertion(
          "available",
          oneOf(result("removal", "data", "status"), [
            "available",
            "dismissed",
          ]),
          "This removal has already been restored.",
        ),
        assertion(
          "set-removal",
          equal(result("removal", "data", "scope"), literal("set")),
          "This removal type is not supported yet.",
        ),
        get("occurrence", "occurrence", result("removal", "data", "contextId")),
        assertion(
          "same-parent",
          equal(
            result("occurrence", "revision"),
            result("removal", "data", "contextRevision"),
          ),
          "The exercise changed. This removal can no longer be undone.",
        ),
        currentSets(),
        assertion(
          "same-sets",
          equal(
            references(result("current", "records")),
            result("removal", "data", "remaining"),
          ),
          "The sets changed. This removal can no longer be undone.",
        ),
        update(
          "restoring",
          "removal",
          input("id"),
          input("revision"),
          retainedData("removal", "removal", { status: literal("restoring") }),
        ),
        batch(
          "groups",
          "restore-workout-set-group",
          result("removal", "data", "records", "sets"),
          fields({ removalId: input("id"), records: item() }),
          50,
        ),
        update(
          "applied",
          "removal",
          input("id"),
          result("restoring", "revision"),
          retainedData("removal", "restoring", { status: literal("applied") }),
        ),
      ],
      result: result("applied"),
    },
  },
  {
    name: "restore-workout-set-group",
    summary: "Restore a bounded set group inside an admitted Undo transaction",
    effect: "transaction",
    capabilities: [...readCaps("removal"), ...writeCaps("set")],
    inputSchema: object({
      removalId: reference,
      records: list(recordReference, 10),
    }),
    resultSchema: object({}),
    recipe: {
      version: 1,
      steps: [
        ...restoreContext(),
        batch(
          "sets",
          "restore-workout-set",
          input("records"),
          fields({
            removalId: input("removalId"),
            id: item("id"),
            revision: item("revision"),
          }),
          10,
        ),
      ],
      result: literal({}),
    },
  },
  {
    name: "restore-workout-set",
    summary:
      "Restore canonical set data only inside its admitted Undo transaction",
    effect: "transaction",
    capabilities: [...readCaps("removal"), ...writeCaps("set")],
    inputSchema: object({ removalId: reference, ...revisionInput.properties }),
    resultSchema: recordReference,
    recipe: {
      version: 1,
      steps: [
        ...restoreContext(),
        {
          id: "saved",
          op: "restore",
          table: "set",
          recordId: input("id"),
          revision: input("revision"),
        },
        assertion(
          "same-occurrence",
          equal(
            result("saved", "data", "occurrenceId"),
            result("removal", "data", "contextId"),
          ),
          "The set belongs to another exercise occurrence.",
        ),
        assertion(
          "same-session",
          equal(
            result("saved", "data", "sessionId"),
            result("removal", "data", "sessionId"),
          ),
          "The set belongs to another workout.",
        ),
      ],
      result: fields({
        id: result("saved", "id"),
        revision: result("saved", "revision"),
      }),
    },
  },
  {
    name: "dismiss-workout-removal",
    summary:
      "Hide this Undo control while retaining its tombstones and metadata",
    effect: "transaction",
    capabilities: [...readCaps("removal"), ...writeCaps("removal")],
    inputSchema: revisionInput,
    resultSchema: rowSchema("removal"),
    recipe: {
      version: 1,
      steps: [
        get("removal", "removal", input("id")),
        requireRevision(),
        assertion(
          "available",
          equal(result("removal", "data", "status"), literal("available")),
          "This Undo control is no longer available.",
        ),
        update(
          "saved",
          "removal",
          input("id"),
          input("revision"),
          retainedData("removal", "removal", { status: literal("dismissed") }),
        ),
      ],
      result: result("saved"),
    },
  },
  {
    ...readAction(
      "get-workout-removal",
      "Read retained removal metadata",
      entityInput,
      [get("removal", "removal", input("id"))],
      rowSchema("removal"),
      result("removal"),
    ),
    capabilities: readCaps("removal"),
  },
  {
    ...readAction(
      "latest-set-removal",
      "Read the latest available Undo for an exercise occurrence",
      object({ occurrenceId: reference }),
      [
        get("occurrence", "occurrence", input("occurrenceId")),
        {
          id: "page",
          op: "query",
          table: "removal",
          limit: 1,
          where: [
            {
              field: ["contextId"],
              compare: "eq",
              value: result("occurrence", "id"),
            },
            { field: ["scope"], compare: "eq", value: literal("set") },
            { field: ["status"], compare: "eq", value: literal("available") },
          ],
          order: [{ field: ["createdAt"], direction: "desc" }],
        },
      ],
      pageSchema("removal", 1),
      result("page"),
    ),
    capabilities: readCaps("removal", "occurrence"),
  },
];

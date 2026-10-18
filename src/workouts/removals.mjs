import { object, reference } from "../schema.mjs";
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
  length,
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
import { removalRestoreActions } from "./removal-restore.mjs";
import { removalValidationActions } from "./removal-validation.mjs";
import { removalDeleteActions } from "./removal-delete.mjs";
import { treeRemovalActions } from "./removal-tree.mjs";

export const removalActions = [
  ...removalRestoreActions,
  ...removalValidationActions,
  ...removalDeleteActions,
  ...treeRemovalActions,
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
            label: result("occurrence", "data", "snapshot", "name"),
            ordinal: {
              op: "check-number",
              minimum: 1,
              maximum: 10,
              integer: true,
              value: binary(
                "add",
                length(
                  filtered(
                    result("sets", "records"),
                    binary(
                      "less",
                      item("data", "position"),
                      result("set", "data", "position"),
                    ),
                    10,
                  ),
                ),
                literal(1),
              ),
            },
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
            remainingOccurrences: literal([]),
            remainingBlocks: literal([]),
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
      ...readCaps("removal", "session", "block", "set", "occurrence"),
      ...writeCaps("removal", "session", "block", "occurrence", "set"),
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
        ...["set", "occurrence", "block"].map((scope) =>
          batch(
            `valid-${scope}`,
            `validate-${scope}-removal`,
            {
              op: "if",
              condition: equal(
                result("removal", "data", "scope"),
                literal(scope),
              ),
              then: literal([0]),
              else: literal([]),
            },
            fields({ removalId: input("id") }),
            1,
          ),
        ),
        update(
          "restoring",
          "removal",
          input("id"),
          input("revision"),
          retainedData("removal", "removal", { status: literal("restoring") }),
        ),
        ...[
          ["sessions", "session", 1],
          ["blocks", "block", 50],
          ["occurrences", "occurrence", 50],
        ].map(([key, table, maximum]) =>
          batch(
            `restored-${key}`,
            `restore-workout-${table}`,
            result("removal", "data", "records", key),
            fields({
              removalId: input("id"),
              id: item("id"),
              revision: item("revision"),
            }),
            maximum,
          ),
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

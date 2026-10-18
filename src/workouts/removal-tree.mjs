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
  length,
  literal,
  not,
  readAction,
  result,
} from "../expressions.mjs";
import {
  create,
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
import { recordReferences } from "./removal-shared.mjs";

const only = (source, offset = 0) => ({
  op: "array",
  items: [
    fields({
      id: result(source, "id"),
      revision: offset
        ? binary("add", result(source, "revision"), literal(offset))
        : result(source, "revision"),
    }),
  ],
});
const remaining = (step, deleted) =>
  recordReferences(
    filtered(
      result(step, "records"),
      not(equal(item("id"), result(deleted, "id"))),
      50,
    ),
  );
const bounded = (step) =>
  assertion(
    `${step}-bound`,
    not({ op: "has", source: result(step), path: ["nextCursor"] }),
    "This removal exceeds the supported workout bounds. Remove a smaller group first.",
  );
const treeCaps = [
  ...readCaps("session", "block", "occurrence", "set", "removal"),
  ...writeCaps("session", "block", "occurrence", "set", "removal"),
];

export const treeRemovalActions = [
  {
    ...readAction(
      "collect-removal-sets",
      "Collect canonical tombstone references for one observed exercise occurrence",
      object({ occurrenceId: reference }),
      [
        get("occurrence", "occurrence", input("occurrenceId")),
        query("sets", "set", "occurrenceId", result("occurrence", "id"), 10),
        bounded("sets"),
      ],
      object({ records: list(recordReference, 10) }),
      fields({ records: recordReferences(result("sets", "records"), 10, 1) }),
    ),
    capabilities: readCaps("occurrence", "set"),
  },
  ...[
    {
      scope: "occurrence",
      name: "remove-workout-exercise",
      summary: "Remove an exercise and its sets, retaining canonical Undo",
    },
    {
      scope: "block",
      name: "remove-workout-block",
      summary:
        "Remove a workout group, its exercises and sets, retaining canonical Undo",
    },
    {
      scope: "session",
      name: "remove-workout",
      summary: "Remove a workout and its records, retaining canonical Undo",
    },
  ].map(({ scope, name, summary }) => ({
    name,
    summary,
    effect: "transaction",
    capabilities: treeCaps,
    inputSchema: revisionInput,
    resultSchema: rowSchema("removal"),
    recipe: {
      version: 1,
      steps: [
        get("target", scope, input("id")),
        assertion(
          "target-revision",
          equal(result("target", "revision"), input("revision")),
          "This record changed. Reload before removing it.",
        ),
        ...(scope === "occurrence"
          ? [
              get("own-block", "block", result("target", "data", "blockId")),
              get("parent", "session", result("target", "data", "sessionId")),
            ]
          : scope === "block"
            ? [get("parent", "session", result("target", "data", "sessionId"))]
            : []),
        query(
          "occurrences",
          "occurrence",
          "sessionId",
          scope === "session"
            ? result("target", "id")
            : result("target", "data", "sessionId"),
          50,
        ),
        query(
          "blocks",
          "block",
          "sessionId",
          scope === "session"
            ? result("target", "id")
            : result("target", "data", "sessionId"),
          50,
        ),
        bounded("occurrences"),
        bounded("blocks"),
        {
          id: "selected",
          op: "let",
          value:
            scope === "occurrence"
              ? only("target")
              : filtered(
                  result("occurrences", "records"),
                  scope === "block"
                    ? equal(item("data", "blockId"), result("target", "id"))
                    : literal(true),
                  50,
                ),
        },
        {
          id: "orphan-block",
          op: "let",
          value:
            scope === "occurrence"
              ? equal(
                  length(
                    filtered(
                      result("occurrences", "records"),
                      binary(
                        "and",
                        equal(
                          item("data", "blockId"),
                          result("target", "data", "blockId"),
                        ),
                        not(equal(item("id"), result("target", "id"))),
                      ),
                      50,
                    ),
                  ),
                  literal(0),
                )
              : literal(false),
        },
        batch(
          "sets",
          "collect-removal-sets",
          result("selected"),
          fields({ occurrenceId: item("id") }),
          50,
        ),
        create(
          "removal",
          "removal",
          fields({
            label:
              scope === "session"
                ? result("target", "data", "title")
                : scope === "occurrence"
                  ? result("target", "data", "snapshot", "name")
                  : {
                      op: "if",
                      condition: equal(
                        result("target", "data", "kind"),
                        literal("superset"),
                      ),
                      then: literal("Superset"),
                      else: {
                        op: "if",
                        condition: equal(
                          result("target", "data", "kind"),
                          literal("circuit"),
                        ),
                        then: literal("Circuit"),
                        else: literal("Single"),
                      },
                    },
            ordinal: {
              op: "check-number",
              minimum: 0,
              maximum: 1000001,
              integer: true,
              value:
                scope === "session"
                  ? literal(0)
                  : binary(
                      "add",
                      scope === "block"
                        ? result("target", "data", "position")
                        : length(
                            filtered(
                              result("occurrences", "records"),
                              binary(
                                "less",
                                item("data", "position"),
                                result("target", "data", "position"),
                              ),
                              50,
                            ),
                          ),
                      literal(1),
                    ),
            },
            scope: literal(scope),
            contextId: result(scope === "session" ? "target" : "parent", "id"),
            contextRevision:
              scope === "session"
                ? binary("add", result("target", "revision"), literal(1))
                : result("parent", "revision"),
            sessionId:
              scope === "session"
                ? result("target", "id")
                : result("target", "data", "sessionId"),
            records: fields({
              sets: {
                op: "map",
                source: result("sets", "results"),
                value: item("records"),
                maxItems: 50,
              },
              occurrences: recordReferences(result("selected"), 50, 1),
              blocks:
                scope === "session"
                  ? recordReferences(result("blocks", "records"), 50, 1)
                  : scope === "block"
                    ? only("target", 1)
                    : {
                        op: "if",
                        condition: result("orphan-block"),
                        then: only("own-block", 1),
                        else: literal([]),
                      },
              sessions: scope === "session" ? only("target", 1) : literal([]),
            }),
            remaining:
              scope === "occurrence"
                ? remaining("occurrences", "target")
                : scope === "block"
                  ? remaining("blocks", "target")
                  : literal([]),
            remainingOccurrences:
              scope === "block"
                ? recordReferences(
                    filtered(
                      result("occurrences", "records"),
                      not(
                        equal(item("data", "blockId"), result("target", "id")),
                      ),
                      50,
                    ),
                  )
                : literal([]),
            remainingBlocks:
              scope === "occurrence"
                ? {
                    op: "if",
                    condition: result("orphan-block"),
                    then: remaining("blocks", "own-block"),
                    else: recordReferences(result("blocks", "records")),
                  }
                : literal([]),
            status: literal("preparing"),
            createdAt: { op: "now" },
          }),
        ),
        batch(
          "removed-sets",
          "delete-workout-set-group",
          result("removal", "data", "records", "sets"),
          fields({
            removalId: result("removal", "id"),
            records: recordReferences(item(), 10, -1),
          }),
          50,
        ),
        ...[
          ["occurrences", "occurrence", 50],
          ["blocks", "block", 50],
          ["sessions", "session", 1],
        ].map(([key, table, maximum]) =>
          batch(
            `removed-${key}`,
            `delete-workout-${table}`,
            result("removal", "data", "records", key),
            fields({
              removalId: result("removal", "id"),
              id: item("id"),
              revision: binary("subtract", item("revision"), literal(1)),
            }),
            maximum,
          ),
        ),
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
  })),
  ...[
    {
      name: "latest-workout-removal",
      scopes: ["occurrence", "block"],
      inputSchema: object({ sessionId: reference }),
      context: true,
    },
    {
      name: "latest-deleted-workout",
      scopes: ["session"],
      inputSchema: object({}),
      context: false,
    },
  ].map(({ name, scopes, inputSchema, context }) => ({
    ...readAction(
      name,
      "Read the latest available canonical Undo in this context",
      inputSchema,
      [
        {
          id: "page",
          op: "query",
          table: "removal",
          limit: 1,
          where: [
            { field: ["scope"], compare: "in", value: literal(scopes) },
            ...(context
              ? [
                  {
                    field: ["sessionId"],
                    compare: "eq",
                    value: input("sessionId"),
                  },
                ]
              : []),
          ],
          order: [{ field: ["createdAt"], direction: "desc" }],
        },
      ],
      pageSchema("removal", 1),
      fields({
        records: filtered(
          result("page", "records"),
          equal(item("data", "status"), literal("available")),
          1,
        ),
      }),
    ),
    capabilities: readCaps("removal"),
  })),
];

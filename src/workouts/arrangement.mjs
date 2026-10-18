import { recordReference } from "../domain-schema.mjs";
import { arrangementCommandActions } from "./arrangement-commands.mjs";
import { object, reference } from "../schema.mjs";
import {
  assertion,
  batch,
  equal,
  fields,
  filtered,
  input,
  length,
  item,
  literal,
  mapped,
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
import {
  arrangementCaps,
  inverseResult,
  arrangementInput,
  at,
  currentRevision,
  indices,
  sameLength,
} from "./arrangement-shared.mjs";
import { arrangementWriteActions } from "./arrangement-write.mjs";

const collections = () => [
  query("blocks", "block", "sessionId", result("session", "id"), 50),
  query("occurrences", "occurrence", "sessionId", result("session", "id"), 50),
];
const sessionFence = () =>
  update(
    "session-saved",
    "session",
    result("session", "id"),
    result("session", "revision"),
    retainedData("session", "session", {}),
  );
const bound = (page) =>
  assertion(
    `${page}-bound`,
    {
      op: "not",
      value: { op: "has", source: result(page), path: ["nextCursor"] },
    },
    "Use at most 50 groups and exercises in a workout.",
  );
const arrangementPhase = (table, undo = false) => {
  const page = table === "block" ? "blocks" : "occurrences";
  const values = undo ? result("arrangement", "data", page) : input(page);
  const value = at(values, item());
  const prepared = result(`prepared-${table}`, "results");
  const args = fields({
    arrangementId: result("arrangement", "id"),
    value,
    position: undo ? at(result(`positions-${table}`), item()) : item(),
    exact: literal(undo),
  });
  const indexes = result(`indices-${table}`);
  return [
    { id: `ids-${table}`, op: "let", value: mapped(values, item("id"), 50) },
    assertion(
      `unique-${table}`,
      equal(
        length(result(`ids-${table}`)),
        length({ op: "unique", source: result(`ids-${table}`), maxItems: 50 }),
      ),
      "Each workout record must occur exactly once in the layout.",
    ),
    ...(undo
      ? [
          {
            id: `positions-${table}`,
            op: "let",
            value: mapped(values, item("position"), 50),
          },
        ]
      : []),
    { id: `indices-${table}`, op: "let", value: indices(values) },
    { id: `args-${table}`, op: "let", value: mapped(indexes, args, 50) },
    batch(
      `prepared-${table}`,
      `prepare-workout-arrangement-${table}`,
      result(`args-${table}`),
      item(),
      50,
    ),
    {
      id: `changed-${table}`,
      op: "let",
      value: mapped(prepared, item("changed"), 50),
    },
    batch(
      `arranged-${table}`,
      `arrange-workout-${table}`,
      filtered(
        indexes,
        {
          op: "at",
          source: result(`changed-${table}`),
          index: item(),
        },
        50,
      ),
      at(result(`args-${table}`), item()),
      50,
    ),
  ];
};
const inverse = (table) =>
  mapped(
    result(`prepared-${table}`, "results"),
    fields(
      Object.fromEntries(
        Object.keys(inverseResult(table).properties).map((key) => [
          key,
          item(key),
        ]),
      ),
    ),
    50,
  );

export const arrangementActions = [
  ...arrangementCommandActions,
  ...arrangementWriteActions,
  {
    name: "arrange-workout",
    summary:
      "Arrange an exact workout layout atomically, retaining canonical compensating Undo",
    effect: "transaction",
    capabilities: arrangementCaps,
    inputSchema: arrangementInput,
    resultSchema: recordReference,
    recipe: {
      version: 1,
      steps: [
        get("session", "session", input("id")),
        currentRevision("session"),
        ...collections(),
        bound("blocks"),
        bound("occurrences"),
        sameLength("blocks", input("blocks")),
        sameLength("occurrences", input("occurrences")),
        create(
          "arrangement",
          "arrangement",
          fields({
            sessionId: result("session", "id"),
            sessionRevision: result("session", "revision"),
            blocks: literal([]),
            occurrences: literal([]),
            status: literal("preparing"),
            createdAt: { op: "now" },
          }),
        ),
        ...arrangementPhase("block"),
        ...arrangementPhase("occurrence"),
        batch(
          "valid-blocks",
          "validate-arranged-workout-block",
          input("blocks"),
          fields({ id: item("id") }),
          50,
        ),
        sessionFence(),
        update(
          "available",
          "arrangement",
          result("arrangement", "id"),
          result("arrangement", "revision"),
          fields({
            sessionId: result("session", "id"),
            sessionRevision: result("session-saved", "revision"),
            blocks: inverse("block"),
            occurrences: inverse("occurrence"),
            status: literal("available"),
            createdAt: result("arrangement", "data", "createdAt"),
          }),
        ),
      ],
      result: fields({
        id: result("available", "id"),
        revision: result("available", "revision"),
      }),
    },
  },
  {
    name: "undo-workout-arrangement",
    summary:
      "Undo a workout arrangement only while its observed structure remains current",
    effect: "transaction",
    capabilities: arrangementCaps,
    inputSchema: revisionInput,
    resultSchema: recordReference,
    recipe: {
      version: 1,
      steps: [
        get("arrangement", "arrangement", input("id")),
        currentRevision("arrangement"),
        assertion(
          "available",
          equal(result("arrangement", "data", "status"), literal("available")),
          "This arrangement can no longer be undone.",
        ),
        get("session", "session", result("arrangement", "data", "sessionId")),
        assertion(
          "same-workout",
          equal(
            result("session", "revision"),
            result("arrangement", "data", "sessionRevision"),
          ),
          "The workout changed. This arrangement can no longer be undone.",
        ),
        ...collections(),
        bound("blocks"),
        bound("occurrences"),
        sameLength("blocks", result("arrangement", "data", "blocks")),
        sameLength("occurrences", result("arrangement", "data", "occurrences")),
        update(
          "restoring",
          "arrangement",
          input("id"),
          input("revision"),
          retainedData("arrangement", "arrangement", {
            status: literal("restoring"),
          }),
        ),
        ...arrangementPhase("block", true),
        ...arrangementPhase("occurrence", true),
        sessionFence(),
        update(
          "applied",
          "arrangement",
          input("id"),
          result("restoring", "revision"),
          retainedData("arrangement", "restoring", {
            status: literal("applied"),
          }),
        ),
      ],
      result: fields({
        id: result("applied", "id"),
        revision: result("applied", "revision"),
      }),
    },
  },
  {
    ...readAction(
      "get-workout-arrangement",
      "Read retained canonical arrangement Undo",
      object({ id: reference }),
      [get("arrangement", "arrangement", input("id"))],
      rowSchema("arrangement"),
      result("arrangement"),
    ),
    capabilities: readCaps("arrangement"),
  },
  {
    name: "dismiss-workout-arrangement",
    summary: "Dismiss the contextual arrangement Undo",
    effect: "transaction",
    capabilities: [...readCaps("arrangement"), ...writeCaps("arrangement")],
    inputSchema: revisionInput,
    resultSchema: recordReference,
    recipe: {
      version: 1,
      steps: [
        get("arrangement", "arrangement", input("id")),
        currentRevision("arrangement"),
        assertion(
          "available",
          equal(result("arrangement", "data", "status"), literal("available")),
          "This Undo is no longer available.",
        ),
        update(
          "dismissed",
          "arrangement",
          input("id"),
          input("revision"),
          retainedData("arrangement", "arrangement", {
            status: literal("dismissed"),
          }),
        ),
      ],
      result: fields({
        id: result("dismissed", "id"),
        revision: result("dismissed", "revision"),
      }),
    },
  },
  {
    ...readAction(
      "latest-workout-arrangement",
      "Read the latest available arrangement Undo",
      object({ sessionId: reference }),
      [
        {
          id: "page",
          op: "query",
          table: "arrangement",
          limit: 1,
          where: [
            { field: ["sessionId"], compare: "eq", value: input("sessionId") },
          ],
          order: [{ field: ["createdAt"], direction: "desc" }],
        },
      ],
      pageSchema("arrangement", 1),
      fields({
        records: filtered(
          result("page", "records"),
          equal(item("data", "status"), literal("available")),
          1,
        ),
      }),
    ),
    capabilities: readCaps("arrangement"),
  },
];

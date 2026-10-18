import { object, reference } from "../schema.mjs";
import {
  assertion,
  batch,
  equal,
  fields,
  input,
  item,
  literal,
  result,
} from "../expressions.mjs";
import {
  activeSession,
  create,
  get,
  query,
  readCaps,
  rowSchema,
  writeCaps,
} from "./shared.mjs";

export const historyCaps = [
  ...readCaps("session", "block", "occurrence", "set"),
  ...writeCaps("session", "block", "occurrence", "set"),
];
const historySession = (sourceSession) => [
  activeSession(),
  assertion(
    "history-workout",
    equal(result("session", "data", "sourceKind"), literal("history")),
    "Choose a workout prepared from history.",
  ),
  assertion(
    "history-source",
    equal(result("session", "data", "sourceId"), sourceSession),
    "The source must belong to this workout's history.",
  ),
];

export const historyCopyActions = [
  {
    name: "copy-history-block",
    summary: "Prepare an independent block from the canonical workout history",
    effect: "transaction",
    capabilities: historyCaps,
    inputSchema: object({ sourceId: reference, sessionId: reference }),
    resultSchema: rowSchema("block"),
    recipe: {
      version: 1,
      steps: [
        get("source", "block", input("sourceId")),
        get("session", "session", input("sessionId")),
        ...historySession(result("source", "data", "sessionId")),
        create(
          "saved",
          "block",
          fields({
            sessionId: input("sessionId"),
            position: result("source", "data", "position"),
            kind: result("source", "data", "kind"),
            rounds: result("source", "data", "rounds"),
            notes: result("source", "data", "notes"),
          }),
        ),
        query("occurrences", "occurrence", "blockId", input("sourceId")),
        batch(
          "copied",
          "copy-history-occurrence",
          result("occurrences", "records"),
          fields({
            sourceId: item("id"),
            blockId: result("saved", "id"),
          }),
          50,
        ),
      ],
      result: result("saved"),
    },
  },
  {
    name: "copy-history-occurrence",
    summary: "Pin a historical exercise snapshot and prepare independent sets",
    effect: "transaction",
    capabilities: historyCaps,
    inputSchema: object({ sourceId: reference, blockId: reference }),
    resultSchema: rowSchema("occurrence"),
    recipe: {
      version: 1,
      steps: [
        get("source", "occurrence", input("sourceId")),
        get("block", "block", input("blockId")),
        get("session", "session", result("block", "data", "sessionId")),
        ...historySession(result("source", "data", "sessionId")),
        create(
          "saved",
          "occurrence",
          fields({
            sessionId: result("session", "id"),
            blockId: input("blockId"),
            position: result("source", "data", "position"),
            snapshot: result("source", "data", "snapshot"),
            restSeconds: result("source", "data", "restSeconds"),
            notes: result("source", "data", "notes"),
          }),
        ),
        query("sets", "set", "occurrenceId", input("sourceId"), 10),
        assertion(
          "set-bound",
          {
            op: "not",
            value: { op: "has", source: result("sets"), path: ["nextCursor"] },
          },
          "Use at most 10 sets per exercise, including rounds.",
        ),
        batch(
          "copied",
          "copy-history-set",
          result("sets", "records"),
          fields({
            sourceId: item("id"),
            occurrenceId: result("saved", "id"),
          }),
          10,
        ),
      ],
      result: result("saved"),
    },
  },
  {
    name: "copy-history-set",
    summary: "Propose historical values without recording performed work",
    effect: "transaction",
    capabilities: historyCaps,
    inputSchema: object({ sourceId: reference, occurrenceId: reference }),
    resultSchema: rowSchema("set"),
    recipe: {
      version: 1,
      steps: [
        get("source", "set", input("sourceId")),
        get("occurrence", "occurrence", input("occurrenceId")),
        get("session", "session", result("occurrence", "data", "sessionId")),
        ...historySession(result("source", "data", "sessionId")),
        get(
          "source-occurrence",
          "occurrence",
          result("source", "data", "occurrenceId"),
        ),
        assertion(
          "pinned-snapshot",
          equal(
            result("occurrence", "data", "snapshot"),
            result("source-occurrence", "data", "snapshot"),
          ),
          "Historical values require their pinned exercise and measurement meanings.",
        ),
        query("previous", "set", "occurrenceId", input("occurrenceId"), 10),
        assertion(
          "set-bound",
          {
            op: "less",
            left: { op: "length", value: result("previous", "records") },
            right: literal(10),
          },
          "This exercise already has 10 sets.",
        ),
        create(
          "saved",
          "set",
          fields({
            occurrenceId: input("occurrenceId"),
            sessionId: result("session", "id"),
            position: result("source", "data", "position"),
            round: result("source", "data", "round"),
            kind: result("source", "data", "kind"),
            planned: {
              op: "if",
              condition: result("source", "data", "completed"),
              then: result("source", "data", "actual"),
              else: result("source", "data", "planned"),
            },
            actual: literal([]),
            completed: literal(false),
            notes: literal(""),
          }),
        ),
      ],
      result: result("saved"),
    },
  },
];

import { totalRecords, routineOccurrenceLimits } from "./start-limits.mjs";
import { plannedSet } from "../domain-schema.mjs";
import { integer, list, object, reference, text } from "../schema.mjs";
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
  mapped,
  result,
} from "../expressions.mjs";
import {
  activeSession,
  appendPosition,
  create,
  get,
  query,
  readCaps,
  rowSchema,
  writeCaps,
} from "../workouts/shared.mjs";

const index = (source, position) => ({ op: "at", source, index: position });
const letValue = (id, value) => ({ id, op: "let", value });
const indices = (count, maximum) =>
  filtered(
    literal(Array.from({ length: maximum }, (_, i) => i)),
    binary("less", item(), count),
    maximum,
  );
const sourceIdentity = {
  routineId: reference,
  blockPosition: integer(0, 29),
  occurrencePosition: integer(0, 11),
};
const sourceBlock = () => [
  get("routine", "routine", input("routineId")),
  letValue(
    "block-source",
    index(result("routine", "data", "blocks"), input("blockPosition")),
  ),
];
const sourceOccurrence = () => [
  ...sourceBlock(),
  letValue(
    "occurrence-source",
    index(result("block-source", "occurrences"), input("occurrencePosition")),
  ),
];
const sourceSession = () => [
  activeSession(),
  assertion(
    "routine-session",
    equal(result("session", "data", "sourceKind"), literal("routine")),
    "This workout was not started from a routine.",
  ),
  assertion(
    "routine-source",
    equal(result("session", "data", "sourceId"), input("routineId")),
    "The workout and routine must match.",
  ),
];
const sourceCaps = readCaps("routine", "session");
const allCaps = [
  ...readCaps("routine", "session", "block", "occurrence", "set"),
  ...writeCaps("session", "block", "occurrence", "set"),
];

export const routineStartActions = [
  {
    name: "start-routine-workout",
    summary: "Start an independent workout from an exact routine revision",
    effect: "transaction",
    capabilities: allCaps,
    inputSchema: object({
      id: reference,
      revision: { type: "integer" },
      timeZone: text(100),
    }),
    resultSchema: rowSchema("session"),
    recipe: {
      version: 1,
      steps: [
        get("routine", "routine", input("id")),
        assertion(
          "revision",
          equal(result("routine", "revision"), input("revision")),
          "This routine changed. Reload it before starting.",
        ),
        assertion(
          "active-routine",
          { op: "not", value: result("routine", "data", "archived") },
          "This routine is archived.",
        ),
        assertion(
          "nonempty-routine",
          binary(
            "greater",
            length(result("routine", "data", "blocks")),
            literal(0),
          ),
          "Add an exercise before starting.",
        ),
        assertion(
          "workout-budget",
          { op: "not", value: binary("greater", totalRecords, literal(100)) },
          "Use fewer exercises, sets or rounds for this workout.",
        ),
        letValue("started", { op: "now" }),
        create(
          "session",
          "session",
          fields({
            title: result("routine", "data", "name"),
            startedAt: result("started"),
            timeZone: input("timeZone"),
            dateKey: {
              op: "date-key",
              value: result("started"),
              timeZone: input("timeZone"),
            },
            status: literal("active"),
            notes: result("routine", "data", "notes"),
            sourceKind: literal("routine"),
            sourceId: input("id"),
          }),
        ),
        batch(
          "blocks",
          "instantiate-routine-block",
          indices(length(result("routine", "data", "blocks")), 30),
          fields({
            sessionId: result("session", "id"),
            routineId: input("id"),
            blockPosition: item(),
          }),
          30,
        ),
      ],
      result: result("session"),
    },
  },
  {
    name: "instantiate-routine-block",
    summary: "Copy one canonical routine block into its active workout",
    effect: "transaction",
    capabilities: allCaps,
    inputSchema: object({
      sessionId: reference,
      routineId: reference,
      blockPosition: integer(0, 29),
    }),
    resultSchema: rowSchema("block"),
    recipe: {
      version: 1,
      steps: [
        ...sourceBlock(),
        get("session", "session", input("sessionId")),
        ...sourceSession(),
        query("previous", "block", "sessionId", result("session", "id"), 50),
        assertion(
          "unused-block-position",
          equal(
            length(
              filtered(
                result("previous", "records"),
                equal(item("data", "position"), input("blockPosition")),
                50,
              ),
            ),
            literal(0),
          ),
          "This routine block is already present. Use the workout structure actions.",
        ),
        create(
          "saved",
          "block",
          fields({
            sessionId: input("sessionId"),
            position: input("blockPosition"),
            kind: result("block-source", "kind"),
            rounds: result("block-source", "rounds"),
            notes: literal(""),
          }),
        ),
        batch(
          "occurrences",
          "instantiate-routine-occurrence",
          indices(length(result("block-source", "occurrences")), 12),
          fields({
            routineId: input("routineId"),
            blockPosition: input("blockPosition"),
            occurrencePosition: item(),
            blockId: result("saved", "id"),
          }),
        ),
      ],
      result: result("saved"),
    },
  },
  {
    name: "instantiate-routine-occurrence",
    summary: "Pin one canonical routine occurrence and prepare its sets",
    effect: "transaction",
    capabilities: allCaps,
    inputSchema: object({ ...sourceIdentity, blockId: reference }),
    resultSchema: rowSchema("occurrence"),
    recipe: {
      version: 1,
      steps: [
        ...sourceOccurrence(),
        get("block", "block", input("blockId")),
        get("session", "session", result("block", "data", "sessionId")),
        ...sourceSession(),
        assertion(
          "block-position",
          equal(result("block", "data", "position"), input("blockPosition")),
          "The routine block must match.",
        ),
        assertion(
          "set-budget",
          {
            op: "not",
            value: binary(
              "greater",
              binary(
                "multiply",
                length(result("occurrence-source", "sets")),
                result("block-source", "rounds"),
              ),
              literal(10),
            ),
          },
          "Use at most 10 sets per exercise, including rounds.",
        ),
        {
          ...query(
            "previous",
            "occurrence",
            "sessionId",
            result("session", "id"),
            50,
          ),
          order: [{ field: ["position"], direction: "desc" }],
        },
        ...routineOccurrenceLimits,
        create(
          "saved",
          "occurrence",
          fields({
            sessionId: result("session", "id"),
            blockId: input("blockId"),
            position: appendPosition("previous"),
            snapshot: result("occurrence-source", "snapshot"),
            restSeconds: result("occurrence-source", "restSeconds"),
            notes: result("occurrence-source", "notes"),
          }),
        ),
        letValue("rounds", indices(result("block-source", "rounds"), 100)),
        batch(
          "plans",
          "instantiate-routine-plan",
          result("occurrence-source", "sets"),
          fields({
            routineId: input("routineId"),
            blockPosition: input("blockPosition"),
            occurrencePosition: input("occurrencePosition"),
            occurrenceId: result("saved", "id"),
            plan: item(),
            rounds: result("rounds"),
          }),
          20,
        ),
      ],
      result: result("saved"),
    },
  },
  {
    name: "instantiate-routine-plan",
    summary: "Copy a planned set across the declared rounds",
    effect: "transaction",
    capabilities: allCaps,
    inputSchema: object({
      ...sourceIdentity,
      occurrenceId: reference,
      plan: plannedSet,
      rounds: list(integer(0, 99), 100),
    }),
    resultSchema: object({}),
    recipe: {
      version: 1,
      steps: [
        batch(
          "rounds",
          "instantiate-routine-set",
          input("rounds"),
          fields({
            ...Object.fromEntries(
              Object.keys(sourceIdentity).map((key) => [key, input(key)]),
            ),
            occurrenceId: input("occurrenceId"),
            plan: input("plan"),
            round: binary("add", item(), literal(1)),
          }),
          100,
        ),
      ],
      result: literal({}),
    },
  },
  {
    name: "instantiate-routine-set",
    summary: "Copy a canonical planned set without inventing actual values",
    effect: "transaction",
    capabilities: [
      ...sourceCaps,
      ...readCaps("block", "occurrence", "set"),
      ...writeCaps("set"),
    ],
    inputSchema: object({
      ...sourceIdentity,
      occurrenceId: reference,
      plan: plannedSet,
      round: integer(1, 100),
    }),
    resultSchema: rowSchema("set"),
    recipe: {
      version: 1,
      steps: [
        ...sourceOccurrence(),
        get("occurrence", "occurrence", input("occurrenceId")),
        get("block", "block", result("occurrence", "data", "blockId")),
        get("session", "session", result("occurrence", "data", "sessionId")),
        ...sourceSession(),
        assertion(
          "pinned-source",
          equal(
            result("occurrence", "data", "snapshot"),
            result("occurrence-source", "snapshot"),
          ),
          "The pinned exercise no longer matches this routine.",
        ),
        assertion(
          "source-position",
          equal(result("block", "data", "position"), input("blockPosition")),
          "The routine block must match.",
        ),
        assertion(
          "source-plan",
          binary(
            "greater",
            length(
              filtered(
                result("occurrence-source", "sets"),
                equal(item(), input("plan")),
                20,
              ),
            ),
            literal(0),
          ),
          "Choose a set from the current routine.",
        ),
        assertion(
          "source-round",
          {
            op: "not",
            value: binary(
              "greater",
              input("round"),
              result("block-source", "rounds"),
            ),
          },
          "The round is outside this routine block.",
        ),
        {
          ...query(
            "previous",
            "set",
            "occurrenceId",
            result("occurrence", "id"),
            10,
          ),
          order: [{ field: ["position"], direction: "desc" }],
        },
        assertion(
          "set-budget",
          binary("less", length(result("previous", "records")), literal(10)),
          "This exercise already has 10 sets.",
        ),
        letValue(
          "in-round",
          filtered(
            result("previous", "records"),
            equal(item("data", "round"), input("round")),
            10,
          ),
        ),
        assertion(
          "round-budget",
          binary(
            "less",
            length(result("in-round")),
            length(result("occurrence-source", "sets")),
          ),
          "This round already has its planned sets.",
        ),
        letValue(
          "planned-position",
          binary(
            "add",
            binary(
              "multiply",
              binary("subtract", input("round"), literal(1)),
              length(result("occurrence-source", "sets")),
            ),
            length(result("in-round")),
          ),
        ),
        create(
          "saved",
          "set",
          fields({
            occurrenceId: input("occurrenceId"),
            sessionId: result("session", "id"),
            position: {
              op: "check-number",
              minimum: 0,
              maximum: 1000000,
              integer: true,
              value: {
                op: "if",
                condition: binary(
                  "greater",
                  length(
                    filtered(
                      result("previous", "records"),
                      equal(
                        item("data", "position"),
                        result("planned-position"),
                      ),
                      10,
                    ),
                  ),
                  literal(0),
                ),
                then: binary(
                  "add",
                  index(
                    mapped(
                      result("previous", "records"),
                      item("data", "position"),
                      10,
                    ),
                    literal(0),
                  ),
                  literal(1),
                ),
                else: result("planned-position"),
              },
            },
            round: input("round"),
            kind: input("plan", "kind"),
            planned: input("plan", "values"),
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

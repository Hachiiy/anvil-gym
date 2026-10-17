import { recordSchemas } from "../domain-schema.mjs";
import { object, reference, text } from "../schema.mjs";
import { fields, input, literal, readAction, result } from "../expressions.mjs";
import {
  activeSession,
  create,
  entityInput,
  get,
  pageSchema,
  readCaps,
  retainedData,
  rowSchema,
  update,
  writeCaps,
} from "./shared.mjs";

export const sessionActions = [
  {
    name: "start-workout",
    summary:
      "Start a free workout using the server time and an explicit time zone",
    effect: "transaction",
    capabilities: writeCaps("session"),
    inputSchema: object({ title: text(120, 1), timeZone: text(100) }),
    resultSchema: rowSchema("session"),
    recipe: {
      version: 1,
      steps: [
        { id: "started", op: "let", value: { op: "now" } },
        create(
          "saved",
          "session",
          fields({
            title: input("title"),
            startedAt: result("started"),
            timeZone: input("timeZone"),
            dateKey: {
              op: "date-key",
              value: result("started"),
              timeZone: input("timeZone"),
            },
            status: literal("active"),
            notes: literal(""),
            sourceKind: literal("free"),
          }),
        ),
      ],
      result: result("saved"),
    },
  },
  {
    ...readAction(
      "get-workout",
      "Read a workout and its lifecycle state",
      entityInput,
      [get("session", "session", input("id"))],
      rowSchema("session"),
      result("session"),
    ),
    capabilities: readCaps("session"),
  },
  {
    ...readAction(
      "list-workouts",
      "List the newest workouts",
      object({}),
      [
        {
          id: "page",
          op: "query",
          table: "session",
          where: [],
          order: [{ field: ["startedAt"], direction: "desc" }],
          limit: 50,
        },
      ],
      pageSchema("session"),
      result("page"),
    ),
    capabilities: readCaps("session"),
  },
  {
    name: "edit-workout",
    summary:
      "Correct a workout title and notes without changing its logged sets",
    effect: "transaction",
    capabilities: [...readCaps("session"), ...writeCaps("session")],
    inputSchema: object({
      id: reference,
      revision: { type: "integer" },
      title: text(120, 1),
      notes: text(2000),
    }),
    resultSchema: rowSchema("session"),
    recipe: {
      version: 1,
      steps: [
        get("session", "session", input("id")),
        update(
          "saved",
          "session",
          input("id"),
          input("revision"),
          retainedData("session", "session", {
            title: input("title"),
            notes: input("notes"),
          }),
        ),
      ],
      result: result("saved"),
    },
  },
  ...["completed", "abandoned"].map((status) => ({
    name: status === "completed" ? "finish-workout" : "abandon-workout",
    summary:
      status === "completed"
        ? "Finish a workout without turning planned sets into performed sets"
        : "End a workout as abandoned while keeping its records",
    effect: "transaction",
    capabilities: [...readCaps("session"), ...writeCaps("session")],
    inputSchema: object({ id: reference, revision: { type: "integer" } }),
    resultSchema: rowSchema("session"),
    recipe: {
      version: 1,
      steps: [
        get("session", "session", input("id")),
        activeSession(),
        update(
          "saved",
          "session",
          input("id"),
          input("revision"),
          retainedData("session", "session", {
            status: literal(status),
            endedAt: { op: "now" },
          }),
        ),
      ],
      result: result("saved"),
    },
  })),
];

import { choice, flag, object, text } from "./schema.mjs";
import {
  equal,
  filtered,
  input,
  item,
  literal,
  readAction,
  result,
} from "./expressions.mjs";
import {
  libraryPage,
  libraryRowsStep,
  libraryResult,
} from "./library-summary.mjs";
import { readCaps } from "./workouts/shared.mjs";

export const libraryActions = [
  ...[false, true].map((next) => ({
    ...readAction(
      next ? "next-workout-history" : "list-workout-history",
      "Read compact completed or abandoned workout history with stable pagination",
      object({
        status: choice("all", "completed", "abandoned"),
        ...(next ? { cursor: text(65536) } : {}),
      }),
      [
        {
          id: "page",
          op: "query",
          table: "session",
          where: [
            {
              field: ["status"],
              compare: "in",
              value: filtered(
                literal(["completed", "abandoned"]),
                {
                  op: "or",
                  left: equal(input("status"), literal("all")),
                  right: equal(item(), input("status")),
                },
                2,
              ),
            },
          ],
          order: [{ field: ["startedAt"], direction: "desc" }],
          limit: 50,
          ...(next ? { cursor: input("cursor") } : {}),
        },
        libraryRowsStep("session"),
      ],
      libraryPage("session"),
      libraryResult(),
    ),
    capabilities: readCaps("session"),
  })),
  {
    ...readAction(
      "next-routines",
      "Read the next compact routine library page",
      object({ archived: flag, cursor: text(65536) }),
      [
        {
          id: "page",
          op: "query",
          table: "routine",
          where: [
            { field: ["archived"], compare: "eq", value: input("archived") },
          ],
          order: [{ field: ["name"], direction: "asc" }],
          limit: 50,
          cursor: input("cursor"),
        },
        libraryRowsStep("routine"),
      ],
      libraryPage("routine"),
      libraryResult(),
    ),
    capabilities: readCaps("routine"),
  },
];

// A view keeps one data-source identity while Core chooses the initial or cursor query.
for (const definition of [
  {
    name: "workout-history",
    table: "session",
    first: "list-workout-history",
    next: "next-workout-history",
    filters: { status: choice("all", "completed", "abandoned") },
  },
  {
    name: "exercise-library",
    table: "exercise",
    first: "list-exercises",
    next: "next-exercises",
    filters: {
      archived: flag,
      category: choice("all", "strength", "cardio", "custom"),
    },
  },
  {
    name: "routine-library",
    table: "routine",
    first: "list-routines",
    next: "next-routines",
    filters: { archived: flag },
  },
]) {
  const first = equal(input("cursor"), literal(""));
  const values = Object.fromEntries(
    Object.keys(definition.filters).map((key) => [key, input(key)]),
  );
  libraryActions.push({
    ...readAction(
      `browse-${definition.name}`,
      "Read a compact library page with canonical filters and a bounded opaque cursor",
      object({ ...definition.filters, cursor: text(65536) }),
      [
        {
          id: "first",
          op: "batch",
          action: definition.first,
          maxItems: 1,
          source: {
            op: "if",
            condition: first,
            then: literal([0]),
            else: literal([]),
          },
          input: { op: "object", fields: values },
        },
        {
          id: "next",
          op: "batch",
          action: definition.next,
          maxItems: 1,
          source: {
            op: "if",
            condition: first,
            then: literal([]),
            else: literal([0]),
          },
          input: {
            op: "object",
            fields: { ...values, cursor: input("cursor") },
          },
        },
      ],
      libraryPage(definition.table),
      {
        op: "at",
        source: {
          op: "if",
          condition: first,
          then: result("first", "results"),
          else: result("next", "results"),
        },
        index: literal(0),
      },
    ),
    capabilities: readCaps(definition.table),
  });
}

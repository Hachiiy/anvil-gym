import { metricSnapshot } from "../metric-schema.mjs";
import { flag, list, object, reference, text } from "../schema.mjs";
import {
  all,
  batch,
  binary,
  conditional,
  equal,
  fields,
  filtered,
  input,
  item,
  length,
  literal,
  mapped,
  readAction,
  result,
} from "../expressions.mjs";
import { draftMeasurements } from "./sets.mjs";
import { get, readCaps, rowSchema } from "./shared.mjs";
import {
  at,
  exists,
  historicalExercise,
  letValue,
} from "./comparison-history.ts";

const comparison = object({
  id: reference,
  available: flag,
  values: draftMeasurements,
  dateKey: text(10),
});
const comparisonResult = object({
  records: list(comparison, 10),
  dateKey: text(10),
});
const caps = readCaps("session", "occurrence", "block", "set");
const kinds = ["warmup", "working", "drop"];
const blankHistory = fields({
  dateKey: literal(""),
  definitions: result("current", "exercise", "data", "snapshot", "metrics"),
  records: literal([]),
});

export const comparisonActions = [
  {
    ...readAction(
      "compare-workout-set",
      "Match a set against the already-read compatible historical exercise",
      object({
        set: rowSchema("set"),
        historical: historicalExercise,
        definitions: metricSnapshot,
      }),
      [
        letValue(
          "candidates",
          filtered(
            input("historical", "records"),
            equal(item("kind"), input("set", "data", "kind")),
            10,
          ),
        ),
        letValue(
          "exact",
          filtered(
            result("candidates"),
            all(
              equal(item("position"), input("set", "data", "position")),
              equal(item("round"), input("set", "data", "round")),
            ),
            10,
          ),
        ),
        letValue(
          "values",
          conditional(
            exists(result("candidates")),
            at(
              mapped(
                conditional(
                  exists(result("exact")),
                  result("exact"),
                  result("candidates"),
                ),
                item("actual"),
                10,
              ),
              conditional(
                exists(result("exact")),
                literal(0),
                binary("subtract", length(result("candidates")), literal(1)),
              ),
            ),
            literal([]),
          ),
        ),
        batch(
          "drafts",
          "prepare-set-measurement",
          input("definitions"),
          fields({
            definition: item(),
            values: result("values"),
            historicalDefinitions: input("historical", "definitions"),
          }),
        ),
      ],
      comparison,
      fields({
        id: input("set", "id"),
        available: exists(
          filtered(result("drafts", "results"), {
            op: "has",
            source: item(),
            path: ["value"],
          }),
        ),
        values: result("drafts", "results"),
        dateKey: input("historical", "dateKey"),
      }),
    ),
    capabilities: caps,
  },
  {
    ...readAction(
      "read-workout-comparison",
      "Read each earlier completed exercise once, then compare the current sets",
      object({ id: reference }),
      [
        {
          id: "current",
          op: "invoke",
          action: "get-workout-logging",
          input: fields({ id: input("id") }),
        },
        get(
          "session",
          "session",
          result("current", "exercise", "data", "sessionId"),
        ),
        {
          id: "sessions",
          op: "query",
          table: "session",
          where: [
            { field: ["status"], compare: "eq", value: literal("completed") },
            {
              field: ["startedAt"],
              compare: "lt",
              value: result("session", "data", "startedAt"),
            },
          ],
          order: [{ field: ["startedAt"], direction: "desc" }],
          limit: 20,
        },
        batch(
          "history",
          "read-comparison-history",
          result("sessions", "records"),
          fields({ session: item(), exercise: result("current", "exercise") }),
          20,
        ),
        ...kinds.flatMap((kind) => [
          letValue(
            `${kind}-candidates`,
            filtered(
              result("history", "results"),
              exists(
                filtered(
                  item("records"),
                  equal(item("kind"), literal(kind)),
                  10,
                ),
              ),
              20,
            ),
          ),
          letValue(
            `${kind}-history`,
            conditional(
              exists(result(`${kind}-candidates`)),
              at(result(`${kind}-candidates`)),
              blankHistory,
            ),
          ),
        ]),
        batch(
          "sets",
          "compare-workout-set",
          result("current", "records"),
          fields({
            set: item(),
            definitions: result(
              "current",
              "exercise",
              "data",
              "snapshot",
              "metrics",
            ),
            historical: conditional(
              equal(item("data", "kind"), literal("warmup")),
              result("warmup-history"),
              conditional(
                equal(item("data", "kind"), literal("working")),
                result("working-history"),
                result("drop-history"),
              ),
            ),
          }),
          10,
        ),
        letValue(
          "available",
          filtered(result("sets", "results"), item("available"), 10),
        ),
      ],
      comparisonResult,
      fields({
        records: result("sets", "results"),
        dateKey: conditional(
          exists(result("available")),
          at(mapped(result("available"), item("dateKey"), 10)),
          literal(""),
        ),
      }),
    ),
    capabilities: caps,
  },
  {
    ...readAction(
      "get-workout-comparison",
      "Read bounded previous set values; unused card slots perform no lookup",
      object({ ids: list(reference, 1) }),
      [
        batch(
          "comparison",
          "read-workout-comparison",
          input("ids"),
          fields({ id: item() }),
          1,
        ),
      ],
      comparisonResult,
      conditional(
        exists(result("comparison", "results")),
        at(result("comparison", "results")),
        literal({ records: [], dateKey: "" }),
      ),
    ),
    capabilities: caps,
  },
];

import { measurements, metricSnapshot } from "../metric-schema.mjs";
import { choice, flag, integer, object, reference, text } from "../schema.mjs";
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
  readAction,
  result,
} from "../expressions.mjs";
import { actualValues, draftMeasurements } from "./sets.mjs";
import {
  entityInput,
  get,
  readCaps,
  retainedData,
  rowSchema,
  update,
  writeCaps,
} from "./shared.mjs";

const at = (source, index = literal(0)) => ({ op: "at", source, index });
const letValue = (id, value) => ({ id, op: "let", value });
const exists = (source) => binary("greater", length(source), literal(0));
const one = (source) => ({ op: "array", items: [at(source)] });
const geometry = {
  setPosition: integer(0, 1000000),
  round: integer(1, 100),
  kind: choice("warmup", "working", "drop"),
  definitions: metricSnapshot,
};
const sourceSchema = object({
  sessionId: reference,
  occurrenceId: reference,
  setId: reference,
  revision: { type: "integer" },
  dateKey: text(10, 10),
});
const candidateSchema = object(
  {
    available: flag,
    values: measurements,
    definitions: metricSnapshot,
    source: sourceSchema,
  },
  ["available", "values", "definitions"],
);
const unavailable = () =>
  fields({
    available: literal(false),
    values: literal([]),
    definitions: input("definitions"),
  });
const caps = readCaps("session", "occurrence", "set");
const geometryInput = Object.fromEntries(
  Object.keys(geometry).map((key) => [key, input(key)]),
);

export const targetActions = [
  {
    ...readAction(
      "history-occurrence-targets",
      "Read performed values from one completed historical exercise occurrence",
      object({ occurrenceId: reference, sessionId: reference, ...geometry }),
      [
        get("occurrence", "occurrence", input("occurrenceId")),
        get("session", "session", input("sessionId")),
        {
          id: "sets",
          op: "query",
          table: "set",
          where: [
            {
              field: ["occurrenceId"],
              compare: "eq",
              value: input("occurrenceId"),
            },
            { field: ["completed"], compare: "eq", value: literal(true) },
            { field: ["kind"], compare: "eq", value: input("kind") },
          ],
          order: [{ field: ["position"], direction: "asc" }],
          limit: 10,
        },
        letValue(
          "same-position",
          filtered(
            result("sets", "records"),
            all(
              equal(item("data", "position"), input("setPosition")),
              equal(item("data", "round"), input("round")),
            ),
            10,
          ),
        ),
        letValue(
          "available",
          all(
            equal(result("session", "data", "status"), literal("completed")),
            equal(
              result("occurrence", "data", "sessionId"),
              input("sessionId"),
            ),
            exists(result("sets", "records")),
          ),
        ),
        letValue(
          "choice",
          conditional(
            result("available"),
            conditional(
              exists(result("same-position")),
              at(result("same-position")),
              at(
                result("sets", "records"),
                binary(
                  "subtract",
                  length(result("sets", "records")),
                  literal(1),
                ),
              ),
            ),
            literal({}),
          ),
        ),
      ],
      candidateSchema,
      conditional(
        result("available"),
        fields({
          available: literal(true),
          values: result("choice", "data", "actual"),
          definitions: result("occurrence", "data", "snapshot", "metrics"),
          source: fields({
            sessionId: result("session", "id"),
            occurrenceId: result("occurrence", "id"),
            setId: result("choice", "id"),
            revision: result("choice", "revision"),
            dateKey: result("session", "data", "dateKey"),
          }),
        }),
        unavailable(),
      ),
    ),
    capabilities: caps,
  },
  {
    ...readAction(
      "history-session-targets",
      "Find the corresponding exercise in a completed workout",
      object({
        sessionId: reference,
        exerciseId: reference,
        occurrencePosition: integer(0, 1000000),
        ...geometry,
      }),
      [
        {
          id: "occurrences",
          op: "query",
          table: "occurrence",
          where: [
            { field: ["sessionId"], compare: "eq", value: input("sessionId") },
            {
              field: ["snapshot", "exerciseId"],
              compare: "eq",
              value: input("exerciseId"),
            },
          ],
          order: [{ field: ["position"], direction: "asc" }],
          limit: 50,
        },
        letValue(
          "same-position",
          filtered(
            result("occurrences", "records"),
            equal(item("data", "position"), input("occurrencePosition")),
            50,
          ),
        ),
        letValue(
          "choice",
          conditional(
            exists(result("same-position")),
            one(result("same-position")),
            conditional(
              exists(result("occurrences", "records")),
              one(result("occurrences", "records")),
              literal([]),
            ),
          ),
        ),
        batch(
          "candidate",
          "history-occurrence-targets",
          result("choice"),
          fields({
            occurrenceId: item("id"),
            sessionId: input("sessionId"),
            ...geometryInput,
          }),
          1,
        ),
      ],
      candidateSchema,
      conditional(
        exists(result("candidate", "results")),
        at(result("candidate", "results")),
        unavailable(),
      ),
    ),
    capabilities: caps,
  },
  {
    ...readAction(
      "previous-workout-targets",
      "Propose compatible actual values from the 20 most recent earlier completed workouts",
      entityInput,
      [
        get("set", "set", input("id")),
        get("occurrence", "occurrence", result("set", "data", "occurrenceId")),
        get("session", "session", result("set", "data", "sessionId")),
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
          "candidates",
          "history-session-targets",
          result("sessions", "records"),
          fields({
            sessionId: item("id"),
            exerciseId: result("occurrence", "data", "snapshot", "exerciseId"),
            occurrencePosition: result("occurrence", "data", "position"),
            setPosition: result("set", "data", "position"),
            round: result("set", "data", "round"),
            kind: result("set", "data", "kind"),
            definitions: result("occurrence", "data", "snapshot", "metrics"),
          }),
          20,
        ),
        letValue(
          "available",
          filtered(result("candidates", "results"), item("available"), 20),
        ),
        letValue(
          "previous",
          conditional(
            exists(result("available")),
            at(result("available")),
            fields({
              available: literal(false),
              values: literal([]),
              definitions: result("occurrence", "data", "snapshot", "metrics"),
            }),
          ),
        ),
        batch(
          "drafts",
          "prepare-set-measurement",
          result("occurrence", "data", "snapshot", "metrics"),
          fields({
            definition: item(),
            values: result("previous", "values"),
            historicalDefinitions: result("previous", "definitions"),
          }),
        ),
        letValue(
          "compatible",
          filtered(result("drafts", "results"), {
            op: "has",
            source: item(),
            path: ["value"],
          }),
        ),
      ],
      object(
        { available: flag, values: draftMeasurements, source: sourceSchema },
        ["available", "values"],
      ),
      conditional(
        all(result("previous", "available"), exists(result("compatible"))),
        fields({
          available: literal(true),
          values: result("drafts", "results"),
          source: result("previous", "source"),
        }),
        fields({
          available: literal(false),
          values: result("drafts", "results"),
        }),
      ),
    ),
    capabilities: caps,
  },
  {
    name: "plan-workout-set",
    summary: "Edit targets without changing performed values or completion",
    effect: "transaction",
    capabilities: [...readCaps("set", "occurrence"), ...writeCaps("set")],
    inputSchema: object({
      id: reference,
      revision: { type: "integer" },
      values: draftMeasurements,
    }),
    resultSchema: rowSchema("set"),
    recipe: {
      version: 1,
      steps: [
        get("set", "set", input("id")),
        get("occurrence", "occurrence", result("set", "data", "occurrenceId")),
        letValue("values", actualValues),
        batch(
          "valid-values",
          "validate-measurement",
          result("values"),
          fields({
            measurement: item(),
            values: result("values"),
            definitions: result("occurrence", "data", "snapshot", "metrics"),
          }),
        ),
        update(
          "saved",
          "set",
          input("id"),
          input("revision"),
          retainedData("set", "set", { planned: result("values") }),
        ),
      ],
      result: result("saved"),
    },
  },
];

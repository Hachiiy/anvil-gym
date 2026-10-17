import { tables } from "./domain-schema.mjs";
import { metricActions } from "./metric-actions.mjs";
import { metricCases } from "./metric-fixtures.mjs";
import { metricVersionAction } from "./metric-versions.mjs";
import { exerciseActions } from "./exercise-actions.mjs";
import { authoredMetric } from "./metric-schema.mjs";
import { sessionActions } from "./workouts/sessions.mjs";
import { workoutExerciseActions } from "./workouts/exercises.mjs";
import { setActions } from "./workouts/sets.mjs";

/** @returns {import("@anvil/app-sdk/author").AppManifest} */
export function createGymManifest() {
  return {
    schemaVersion: "2.0",
    package: {
      key: "gym",
      name: "Gym",
      kind: "app",
      version: "0.1.0",
      summary: "Strength, cardio and custom exercise measurements",
      description:
        "A Gym App using shared actions and managed persistent data. Development version; no installable release is published yet.",
      categories: ["fitness"],
      license: "Apache-2.0",
    },
    publisher: { displayName: "Gym contributors" },
    compatibility: {
      coreActionApi: 1,
      recipeFormat: 1,
      integrationAdapter: 1,
      nativeUi: 1,
      designComponents: 1,
    },
    assets: [],
    tables,
    actions: [
      ...metricActions,
      metricVersionAction,
      ...exerciseActions,
      ...sessionActions,
      ...workoutExerciseActions,
      ...setActions,
      {
        name: "new-measurement",
        summary: "Prepare a new custom measurement with a stable identity",
        effect: "read",
        capabilities: [],
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        },
        resultSchema: authoredMetric,
        recipe: {
          version: 1,
          steps: [],
          result: {
            op: "object",
            fields: Object.fromEntries(
              Object.entries({
                key: null,
                label: "Custom measurement",
                kind: "decimal",
                dimension: "custom",
                unit: "unit",
                loadMeaning: "none",
                minimum: 0,
                maximum: 1000000000,
                precision: 2,
                required: false,
                signed: false,
              }).map(([key, value]) => [
                key,
                key === "key" ? { op: "id" } : { op: "literal", value },
              ]),
            ),
          },
        },
      },
    ],
    integrations: [],
    schedules: [],
    ui: [],
    capabilities: ["exercise", "session", "block", "occurrence", "set"].flatMap(
      (table) => [`data.${table}.read`, `data.${table}.write`],
    ),
    dependencies: [],
    dataSources: [],
    migrations: [],
    fixtures: metricCases
      .filter((test) => test.valid)
      .map(({ action, input }) => ({
        action,
        input,
        expect: { valid: true },
      })),
    modelClaims: [],
  };
}

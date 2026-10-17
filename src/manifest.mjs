import { tables } from "./domain-schema.mjs";
import { metricActions } from "./metric-actions.mjs";
import { metricCases } from "./metric-fixtures.mjs";
import { metricVersionAction } from "./metric-versions.mjs";
import { exerciseActions } from "./exercise-actions.mjs";

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
    actions: [...metricActions, metricVersionAction, ...exerciseActions],
    integrations: [],
    schedules: [],
    ui: [],
    capabilities: ["data.exercise.read", "data.exercise.write"],
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

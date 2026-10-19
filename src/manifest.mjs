import { libraryActions } from "./library-actions.mjs";
import { groupEditorAction } from "./workouts/group-editor.mjs";
import { arrangementActions } from "./workouts/arrangement.mjs";
import { structureActions } from "./workouts/structure.mjs";
import { tables } from "./domain-schema.mjs";
import { metricActions } from "./metric-actions.mjs";
import { metricCases } from "./metric-fixtures.mjs";
import { metricVersionAction } from "./metric-versions.mjs";
import { exerciseActions } from "./exercise-actions.mjs";
import { authoredMetric } from "./metric-schema.mjs";
import { sessionActions } from "./workouts/sessions.mjs";
import { workoutExerciseActions } from "./workouts/exercises.mjs";
import { setActions } from "./workouts/sets.mjs";
import { catalogActions } from "./catalog-actions.mjs";
import { catalogSelectionTable } from "./catalog.mjs";
import { routineActions } from "./routines/actions.mjs";
import { routineValidationActions } from "./routines/validation.mjs";
import { routineBlockActions } from "./routines/blocks.mjs";
import { routineStartActions } from "./routines/start.mjs";
import { workoutOutlineActions } from "./workouts/outline.mjs";
import { loggingActions } from "./workouts/logging.mjs";
import { targetActions } from "./workouts/targets.mjs";
import { historyStartAction } from "./workouts/history-start.mjs";
import { historyCopyActions } from "./workouts/history-copy.mjs";
import { orderActions } from "./workouts/order.mjs";
import { removalActions } from "./workouts/removals.mjs";
import { overviewActions } from "./workouts/overview.ts";
import { comparisonHistoryActions } from "./workouts/comparison-history.ts";
import { comparisonActions } from "./workouts/comparison.ts";
import {
  routineTargetActions,
  routineCapacityActions,
} from "./routines/targets.ts";

/** @returns {import("@anvil/app-sdk/author").AppManifest} */
export function createGymManifest() {
  return {
    schemaVersion: "2.0",
    package: {
      key: "gym",
      name: "Gym",
      kind: "app",
      version: "0.2.1",
      summary: "Your workouts and routines, kept simple",
      description:
        "Build your routine, record your sets and pick up where you left off. Gym brings strength training, basic cardio and your own custom exercises into Anvil.\n\nCreate reusable routines with supersets and circuits, keep planned and performed values separate, and revisit your workout history. Measurements retain their units and meaning.\n\nUse Gym yourself or give an agent access to help you manage it. Requires an online Anvil connection.",
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
    assets: [
      { path: "assets/store/icon.png", mediaType: "image/png", role: "icon" },
      { path: "assets/store/cover.png", mediaType: "image/png", role: "cover" },
      {
        path: "assets/store/workout.png",
        mediaType: "image/png",
        role: "screenshot-1",
      },
      {
        path: "assets/store/exercises.png",
        mediaType: "image/png",
        role: "screenshot-2",
      },
      {
        path: "assets/store/routine.png",
        mediaType: "image/png",
        role: "screenshot-3",
      },
      {
        path: "data/starter-catalog.json",
        mediaType: "application/json",
        role: "data",
      },
      {
        path: "data/starter-catalog.provenance.json",
        mediaType: "application/json",
        role: "data",
      },
      {
        path: "data/free-exercise-db-LICENSE.txt",
        mediaType: "text/plain",
        role: "documentation",
      },
    ],
    tables: [...tables, catalogSelectionTable],
    actions: [
      ...libraryActions,
      ...metricActions,
      metricVersionAction,
      ...exerciseActions,
      ...sessionActions,
      ...workoutExerciseActions,
      ...setActions,
      ...catalogActions,
      ...routineActions,
      ...routineValidationActions,
      ...routineBlockActions,
      ...routineStartActions,
      ...workoutOutlineActions,
      ...loggingActions,
      ...overviewActions,
      ...comparisonActions,
      ...comparisonHistoryActions,
      ...routineTargetActions,
      ...routineCapacityActions,
      ...targetActions,
      historyStartAction,
      ...historyCopyActions,
      ...orderActions,
      ...removalActions,
      ...structureActions,
      ...arrangementActions,
      groupEditorAction,
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
    capabilities: [
      "exercise",
      "routine",
      "session",
      "block",
      "occurrence",
      "set",
      "catalog-selection",
      "removal",
      "arrangement",
    ].flatMap((table) => [`data.${table}.read`, `data.${table}.write`]),
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

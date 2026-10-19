import { workoutGroup } from "./views/workout-group.js";
import { defineApp } from "@anvil/app-sdk/author";
import { createGymManifest } from "./manifest.mjs";
import { exerciseLibrary } from "./views/exercise-library.js";
import { exerciseEditor } from "./views/exercise-editor.js";
import { workouts, startWorkout, workout } from "./views/workouts.js";
import { workoutOverview } from "./views/workout-overview.js";
import { routineTargets } from "./views/routine-targets.js";
import { chooseExercise } from "./views/workout-exercises.js";
import { workoutLogging } from "./views/workout-logging.js";
import { workoutSet } from "./views/workout-set.js";
import { workoutTargets } from "./views/workout-targets.js";
import { workoutStructure } from "./views/workout-structure.js";
import { workoutSetOrder } from "./views/workout-set-order.js";
import { starterCatalog } from "./views/starter-catalog.js";
import {
  routineLibrary,
  newRoutine,
  routineEditor,
  routineBlockEditor,
} from "./views/routines.js";

// Existing business definitions keep their stable table/action/metric identities.
// Native views are added through the same public author SDK.
export default defineApp({
  ...createGymManifest(),
  ui: [
    workouts,
    startWorkout,
    workoutOverview,
    workout,
    chooseExercise,
    workoutLogging,
    workoutSet,
    workoutTargets,
    workoutSetOrder,
    workoutStructure,
    workoutGroup,
    routineLibrary,
    newRoutine,
    routineEditor,
    routineBlockEditor,
    routineTargets,
    exerciseLibrary,
    starterCatalog,
    exerciseEditor(false),
    exerciseEditor(true),
  ],
});

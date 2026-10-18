import { defineApp } from "@anvil/app-sdk/author";
import { createGymManifest } from "./manifest.mjs";
import { exerciseLibrary } from "./views/exercise-library.js";
import { exerciseEditor } from "./views/exercise-editor.js";
import { workouts, startWorkout, workout } from "./views/workouts.js";
import { chooseExercise } from "./views/workout-exercises.js";
import { workoutLogging } from "./views/workout-logging.js";
import { workoutSet } from "./views/workout-set.js";
import { workoutTargets } from "./views/workout-targets.js";
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
    workout,
    chooseExercise,
    workoutLogging,
    workoutSet,
    workoutTargets,
    routineLibrary,
    newRoutine,
    routineEditor,
    routineBlockEditor,
    exerciseLibrary,
    starterCatalog,
    exerciseEditor(false),
    exerciseEditor(true),
  ],
});

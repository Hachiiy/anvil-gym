import { defineApp } from "@anvil/app-sdk/author";
import { createGymManifest } from "./manifest.mjs";
import { exerciseLibrary } from "./views/exercise-library.js";
import { exerciseEditor } from "./views/exercise-editor.js";

// Existing business definitions keep their stable table/action/metric identities.
// Native views are added through the same public author SDK.
export default defineApp({
  ...createGymManifest(),
  ui: [exerciseLibrary, exerciseEditor(false), exerciseEditor(true)],
});

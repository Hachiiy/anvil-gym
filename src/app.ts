import { defineApp } from "@anvil/app-sdk/author";
import { createGymManifest } from "./manifest.mjs";

// Existing business definitions keep their stable table/action/metric identities.
// Native views are added through the same public author SDK.
export default defineApp(createGymManifest());

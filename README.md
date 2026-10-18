# Gym for Anvil

Gym is a standalone Anvil App for strength, basic cardio and custom exercise
measurements. Its current source defines seven data tables, 64 declared Core
actions and 15 native views, with versioned metrics and editable catalog
provenance. Exercise edits assign new metric versions when measurement meanings
change.

The project is under development; no installable release has been published.
The first native interface provides an exercise library, custom exercise
creation and autosaved exercise editing, including measurement definitions,
units, weight meanings, primary/secondary muscle groups and archive state.
Advanced measurement settings and muscle selection expand when needed.
Library pagination remains planned. The initial library shows up
to 50 active exercises. Existing declared actions support complete exercise
revisions for authorized agents.
Free workouts now have a native start/add-exercise/record-set/finish flow.
Each exercise occurrence keeps a snapshot of its name and measurement meanings;
repeating an exercise creates separate sets. Actual values are recorded through
the same Core actions available to authorized agents. Blank measurements stay
unknown, explicit zeros are retained, and finishing does not complete unlogged
sets. Existing set values can be corrected without rewriting the exercise.
The initial workout profile allows 50 occurrences and 10 sets per occurrence;
lists show the latest 50 workouts/exercises. Routines can be created, listed, read,
revised and archived. A compact block editor supports single exercises, supersets
and circuits, rounds, rest, add/remove sets and repeated exercises. Starting a
routine atomically copies its exercises, rounds and targets into an independent
workout with blank actuals; exercise and metric snapshots remain pinned per
occurrence. Routine planned values are available through declared Core actions.

Templates allow up to 30 blocks, 12 occurrences and 20 planned sets. Existing
64 KiB record and native-form limits still apply. Not every maximum-size template
can start as one workout under the 50-occurrence, 10-sets-per-occurrence and
100-row mutation limits. Start validates those limits, reports them clearly and
rolls back a failed start. Set options now open a separate Targets editor with
autosave and an explicit Use previous action. It considers the 20 most recent
earlier completed workouts, keeps set types distinct and copies only values whose
pinned measurement definitions match. Actuals and completion stay unchanged;
new or changed measurements remain blank. It does not infer progression.
Completed workouts offer **Repeat workout**. The new session preserves grouped
structure, rounds and pinned exercise definitions. Completed actuals become
editable targets; unfinished sets retain their existing targets. All new actuals
start blank and sets remain uncompleted. The source workout is unchanged and
the copy respects the same atomic workout limits as routine starts.
Reordering, reports and legacy import remain planned. Workout and rest timers
are outside the product scope; duration is still a configurable measurement.
Gym uses Anvil's standard App contracts and Core action gateway
and requires an online Anvil connection. Installation does not automatically
assign agents or enable schedules. All verification fixtures are fictional.

The catalog owner flow now browses 19 pinned entries from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db/tree/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5),
then adds an editable copy as a Gym exercise. The catalog-selection record keeps
the original source, commit, license and mapping version. A bounded
`list-starter-copies` read shows existing adapted exercises as “Added” with an
“Open exercise” link; repeating a selection opens the same copy without
creating a duplicate. Other catalog entries do not show an empty unmapped warning.
The read-only `get-exercise-source` action returns catalog source details. Cardio
defaults to seconds and meters, and dumbbell load is per dumbbell; both choices
remain editable. Source shoulder groups remain visibly unmapped because no shoulder
subtype is guessed. The source snapshot, provenance metadata and Unlicense are
included in the repository. Real Nest/PGlite Core cases and desktop/mobile browser
flows passed without a model call. Initial routine principal flows also passed
Core and desktop/mobile browser proof; broader workout and routine acceptance
remains open. An official immutable release, discovery topic and first installation
remain pending.

## Development

Requires Node.js 22 or later. Run `npm ci` and `npm run check` to type-check
the TypeScript App entry, validate the manifest 2.0 package, catalog integrity
and pinned standalone SDK 2 tools. Existing JavaScript business modules keep
their schema/recipe validation; they have not all migrated to TypeScript.
These checks do not execute business actions. The scenarios in
[src/exercise-scenarios.mjs](src/exercise-scenarios.mjs) require an actual
disposable Core adapter; they do not contain a second recipe interpreter.

The public author SDK 2.5.0 is a licensed source distribution in
[tools/sdk](tools/sdk), refreshed from a clean committed product export and
verified against its 49-file hash snapshot. Native manifests remain capped
at 2 MiB and 128,000 JSON nodes; Core data limits remain unchanged. The SDK is
installed through a local file dependency. It needs
only pinned public npm packages, with no private workspace or registry access.
`npx anvil-app build . <empty-output-directory>` builds locally; choose an
empty directory outside this repository. Installed packages contain declarative
data and approved passive assets, never publisher JavaScript or Angular code.
`npm run dev -- <anvil-origin>` connects the public SDK 2.5 preview through
explicit owner consent, then watches, builds and uploads local changes. Preview
credentials stay outside source. `npm run connect -- https://anvil.example`
connects without starting the watcher. No additional local server is needed.
The SDK 2.5 `npm run release` command builds locally and publishes an exact
immutable release through local GitHub CLI authentication. It requires clean,
committed and pushed source and enabled immutable releases. Saved publication
identity stays outside the repository. Static conformance is distinct from Core
and model proof. Publication does not install Gym, assign agents or start a
review. Official publication and discovery remain pending while the App is under
development; its first official installation is performed by the owner.

Catalog and routine tables change the preview table definition fingerprint. An
existing paired development preview requires an explicit reset or a new preview
before the current schema is available; resetting clears that preview’s records.
Installed production datasets are separate. The first official installation
remains an owner action.

## License

Gym package code is Apache-2.0; see [LICENSE](LICENSE). The public catalog source
snapshot uses the [Unlicense](data/free-exercise-db-LICENSE.txt), with pinned
[source metadata](data/starter-catalog.provenance.json). Standalone author-tool
provenance is documented in [tools/README.md](tools/README.md).

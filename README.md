# Gym for Anvil

Gym is a standalone Anvil App for strength, basic cardio and custom exercise
measurements. Its current foundation defines six logical data tables,
versioned metrics and declarative actions for creating, reading, listing,
revising and archiving exercises. Exercise edits assign new metric versions
when measurement meanings change.

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
The initial profile allows 50 occurrences per workout and 10 sets per occurrence;
lists show the latest 50 workouts/exercises. Routines, supersets/circuits,
history-derived targets, richer history corrections, timers, reports and legacy
import remain planned.
Gym uses Anvil's standard App contracts and Core action gateway
and requires an online Anvil connection. Installation does not automatically
assign agents or enable schedules. All verification fixtures are fictional.

The starter source snapshot contains 19 selected entries from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db/tree/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5).
It preserves source and license metadata and includes no training instructions
or images. Exercise defaults and catalog setup remain part of the planned
owner experience.

## Development

Requires Node.js 22 or later. Run `npm ci` and `npm run check` to type-check
the TypeScript App entry, validate the manifest 2.0 package, catalog integrity
and pinned standalone SDK 2 tools. Existing JavaScript business modules keep
their schema/recipe validation; they have not all migrated to TypeScript.
These checks do not execute business actions. The scenarios in
[src/exercise-scenarios.mjs](src/exercise-scenarios.mjs) require an actual
disposable Core adapter; they do not contain a second recipe interpreter.

The public author SDK is a licensed source distribution in
[tools/sdk](tools/sdk), installed through a local file dependency. It needs
only pinned public npm packages, with no private workspace or registry access.
`npx anvil-app build . <empty-output-directory>` builds locally; choose an
empty directory outside this repository. Installed packages contain declarative
data and approved passive assets, never publisher JavaScript or Angular code.
`npm run dev -- https://anvil.example` connects the public SDK 2.3 preview through
explicit owner consent, then watches, builds and uploads local changes. Preview
credentials stay outside source. `npm run connect -- https://anvil.example`
connects without starting the watcher. No additional local server is needed.
The `npm run release` publication workflow remains pending; this repository has
no installable release or discovery topic yet.

The workout development revision changes the table definition fingerprint.
An existing paired development preview therefore requires explicit
`npm run dev -- --reset`; this clears that preview's records. Installed
production datasets are separate.

## License

Gym package code is Apache-2.0; see [LICENSE](LICENSE). The public catalog source
snapshot uses the [Unlicense](data/free-exercise-db-LICENSE.txt), with pinned
[source metadata](data/starter-catalog.provenance.json). Standalone author-tool
provenance is documented in [tools/README.md](tools/README.md).

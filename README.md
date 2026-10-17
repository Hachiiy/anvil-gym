# Gym for Anvil

Gym is a standalone Anvil App for strength, basic cardio and custom exercise
measurements. Its current foundation defines six logical data tables,
versioned metrics and declarative actions for creating, reading, listing,
revising and archiving exercises. Exercise edits assign new metric versions
when measurement meanings change.

The project is under development; no installable release has been published.
Workout sessions, routines, the native interface, reports and legacy import
remain planned. Gym uses Anvil's standard App contracts and Core action gateway
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
The paired `npm run dev` preview and `npm run release` publication workflow
remain under development and are not available commands yet.

## License

Gym package code is Apache-2.0; see [LICENSE](LICENSE). The public catalog source
snapshot uses the [Unlicense](data/free-exercise-db-LICENSE.txt), with pinned
[source metadata](data/starter-catalog.provenance.json). Standalone author-tool
provenance is documented in [tools/README.md](tools/README.md).

# Gym for Anvil

Gym 0.1.2 is an installable MVP for strength, basic cardio and custom exercise
measurements. It uses Anvil's native components and theme, with no iframe or
publisher code running in the installed App.

## Install

Open **Anvil → Market**, find **Gym**, choose an available reviewing agent
and select **Install**. Accept the permissions after the exact package
review completes. If Gym is missing, refresh the Market catalog.

Installation keeps data separate from other Apps and does not grant an agent
access. Enable Gym separately for each agent that should use it. The owner
performs the first official installation.

## MVP scope

- Exercise library with 19 starter entries, custom exercises and measurements.
- Reusable routines with individual exercises, supersets and circuits.
- Online workout logging, separate planned and actual values, and corrections.
- Paged history, repeat workout, ordering, removal and revision-checked Undo.
- Shared Core actions for manual controls and authorized agents.

Measurements preserve units, load meanings and versions. Unknown values stay
blank; recorded zeros remain observations. Later exercise edits do not rewrite
completed workouts. No workout, rest or countdown timer is included; duration
remains an explicit measurement for cardio and custom exercises.

The initial workout profile supports 50 exercise occurrences and 10 sets per
occurrence, within Anvil's existing data and transaction bounds. Libraries page
through 50 entries. Templates support 30 blocks, 12 occurrences per block and
20 planned sets, but a started workout must fit the workout and transaction
bounds. Oversized starts fail atomically rather than creating partial workouts.

Saved reports, muscle maps, Gym chat widgets, legacy import/export and external
integrations are deferred. Offline editing is not supported.

## Development

Use Node.js 22 or later, then `npm ci` and `npm run check`. The standalone SDK
2.11.0 is included through the local dependency [tools/sdk](tools/sdk); no private
workspace or npm registry is needed. Its 50-file hash snapshot is checked
by the author validation. See [tool provenance](tools/README.md).

- `npm run dev -- https://anvil.example` pairs an isolated preview and watches
  local source. Pairing requires explicit owner consent; credentials stay outside
  the repository. An existing preview with an older table layout needs a new
  preview or explicit reset, which clears only that preview's records.
- `npm run build -- <empty-output-directory>` compiles a package outside the
  author repository. Installed packages contain declarative data and approved
  passive assets, never publisher JavaScript, CSS or Angular code.
- `npm run release` publishes the exact clean, committed and pushed source through
  GitHub CLI authentication. Immutable releases must be enabled. Publication
  does not install the App, grant agent access or start a model call.

Static conformance validates the package; it does not execute business actions
or prove a model claim. The MVP retains the previously accepted Core and
responsive browser behavior. Broader feature acceptance remains in progress.
All verification fixtures are fictional.

## License and starter catalog

Gym code is [Apache-2.0](LICENSE). The 19 pinned starter entries come from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db/tree/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5),
with its [Unlicense](data/free-exercise-db-LICENSE.txt) and
[source metadata](data/starter-catalog.provenance.json). Catalog source values
and adaptation provenance are retained; unmapped shoulder subtypes are not guessed.

Store icon and cover are raster artwork generated with OpenAI image generation. Screenshots capture the
real native Gym interface using fictional preview data. Store assets are passive,
digest-bound release files; browsing them does not install Gym.

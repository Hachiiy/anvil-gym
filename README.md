# Gym for Anvil

Gym is a standalone Anvil App for strength, basic cardio and custom exercise
measurements. Its current foundation defines six logical data tables,
versioned metrics and declarative actions for creating, reading, listing,
revising and archiving exercises. Exercise edits assign new metric versions
when measurement meanings change.

The project is under development; no installable release has been published.
Workout sessions, routines, the browser interface, reports and legacy import
remain planned. Gym uses Anvil's standard App contracts and Core action gateway
and requires an online Anvil connection. Installation does not automatically
assign agents or enable schedules. All verification fixtures are fictional.

The starter source snapshot contains 19 selected entries from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db/tree/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5).
It preserves source and license metadata and includes no training instructions
or images. Exercise defaults and catalog setup remain part of the planned
owner experience.

## Development

Requires Node.js 22 or later. Run `npm ci` and `npm run check` to verify the
static manifest, catalog integrity and pinned standalone author tools. These
checks do not execute business actions. The scenarios in
[src/exercise-scenarios.mjs](src/exercise-scenarios.mjs) require an actual
disposable Core adapter; they do not contain a second recipe interpreter.

## License

Gym package code is Apache-2.0; see [LICENSE](LICENSE). The public catalog source
snapshot uses the [Unlicense](data/free-exercise-db-LICENSE.txt), with pinned
[source metadata](data/starter-catalog.provenance.json). Standalone author-tool
provenance is documented in [vendor/README.md](vendor/README.md).

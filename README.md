# Gym for Anvil

Gym 0.4.1 is an installable App for strength, basic cardio and custom exercise
measurements. It uses Anvil's native components and theme, with no iframe or
publisher code running in the installed App.

## Install

Open **Anvil → Market**, find **Gym** and select **Install**. Review in chat
is optional and separate. If Gym is missing, refresh the Market catalog.

Installation keeps data separate from other Apps and includes **Personal Trainer**,
an ordinary agent configured for Gym with access to Gym only. It inherits the
workspace model and starts no model work on installation. An explicit update
can create the trainer once for an existing installation.

The trainer follows Anvil’s standard `initialAgent` contract: after creation,
only the owner controls its settings. Updates, disable, uninstall, data deletion
and reinstall never edit, delete or recreate it, even after an owner deletes
the agent. Its configured Gym grant remains unchanged on uninstall; Gym is
unavailable until reinstalled. Owner edits and revoked access remain intact.
Current Gym capabilities are discovered normally, without updating the agent’s
instructions. Other agents require their own explicit Gym assignment.

## Workouts and routines

- Exercise library with 19 starter entries, custom exercises and measurements.
- Reusable routines with planned measurements for each set. Grouping options
  expose supersets, circuits and rounds when needed.
- Three primary sections: Train, History and Library. Start a free workout or a
  routine directly from Train; creation and advanced editors stay contextual.
- One aggregate read loads the workout and its present cards. Empty positions
  trigger no reads; unchanged autosave forms trigger no writes on navigation.
- A workout overview with six exercise cards per page, inline measurements and
  Done controls. Further measurements, set types and notes remain in Details.
- Planned values beside each set, with compatible history loaded only through
  Previous values. Use plan and Use
  previous fill an empty set without marking it completed or replacing edits.
- Online autosave, visible save feedback, corrections and finish confirmation.
  Finishing a workout preserves unfinished sets and never rewrites its routine.
- Paged history, repeat workout, ordering, removal and revision-checked Undo.
- Shared Core actions for manual controls and authorized agents.

Measurements preserve units, load meanings and versions. Unknown values stay
blank; recorded zeros remain observations. Later exercise edits do not rewrite
completed workouts. No workout, rest or countdown timer is included; duration
remains an explicit measurement for cardio and custom exercises.

The initial workout profile supports 50 exercise occurrences and 10 sets per
occurrence, within Anvil's existing data and transaction bounds. Libraries page
through 50 entries. Templates support 30 blocks, 12 occurrences per block and
20 planned sets. The editor limits new sets to 10 expanded sets per exercise
and explains routines that exceed workout or transaction capacity. Oversized
starts fail atomically rather than creating partial workouts.

Previous values come from the 20 most recent completed sessions. Only completed
sets with compatible measurement identities, versions, units and load meanings
are offered. Set kind is preserved; matching round and position are preferred,
with the last completed set of that kind as fallback. Missing values stay blank.

Saved reports, muscle maps, Gym chat widgets, legacy import/export and external
integrations are deferred. Offline editing is not supported.

## Development

Use Node.js 24 or later, then `npm ci` and `npm run check`. The standalone SDK
2.14.0 is included through the local dependency [tools/sdk](tools/sdk); no private
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
or prove a model claim. Focused acceptance covers routine targets, exact revisions, the overview,
copying previous values, zeros, pagination, autosave, reload and finishing.
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

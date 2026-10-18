# Standalone public App SDK

`sdk/` contains the Apache-2.0 Anvil App author profile 2.7.0 source distribution.
It includes typed native definition builders, package/archive validation,
static conformance, the author-only TypeScript compiler/CLI and their bounded
App contract dependencies. It contains no server, deployment configuration,
credentials or application records.
The author CLI includes owner-approved pairing, private target storage and the
local watch/build/upload workflow and `npm run release` for exact immutable
publication through local GitHub CLI authentication. Release identity stays
outside the repository; publication never installs Gym or starts model work. These author tools never enter installed Apps.

`sdk/snapshot.json` records the committed source revision and SHA-256 of all 49
exported tool files. This SDK 2.7.0 snapshot was refreshed from a clean committed
product export. Native manifests remain capped at 2 MiB and 128,000 JSON
nodes; retained Core data JSON defaults remain 512 KiB and 32,000 nodes, and other
Core action input/result/record/intermediate limits are unchanged. The SDK permits
up to 128 declared actions per manifest and native view; this does not expand
per-call execution depth, ticks or mutations. SDK 2.7 adds the revision-checked
`restore` step for retained canonical records; it preserves current schema,
reference, uniqueness and source-authority checks. The dedicated
host review-input ceiling is 1 MiB, independent of those Core limits. Imports are relocated
within this portable distribution;
unrelated product policies are excluded. `npm run check` verifies those hashes.
Third-party dependencies are pinned in the SDK manifest and root npm lockfile.

These tools run only during explicit local author commands. They are excluded
from distributed App archives. Validation of an installed package never runs
the compiler, imports publisher source or installs npm packages.

See [sdk/LICENSE](sdk/LICENSE).

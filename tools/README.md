# Standalone public App SDK

`sdk/` contains the Apache-2.0 Anvil App author profile 2.14.0 source distribution.
It includes typed native definition builders, package/archive validation,
static conformance, the author-only TypeScript compiler/CLI and their bounded
App contract dependencies. It contains no server, deployment configuration,
credentials or application records.
The author CLI includes owner-approved pairing, private target storage and the
local watch/build/upload workflow and `npm run release` for exact immutable
publication through local GitHub CLI authentication. Release identity stays
outside the repository; publication never installs Gym or starts model work. These author tools never enter installed Apps.

`sdk/snapshot.json` records the source revision and state and SHA-256 of all 50
exported tool files. SDK 2.14.0 is exported from clean committed product source; the snapshot records that exact revision. Native manifests remain capped at 4 MiB and 128,000 JSON
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

SDK 2.8 adds bounded canonical JSON `unique`, retaining first-occurrence order
under the existing per-call budget. No runtime limit or permission is expanded.

SDK 2.10 adds shared native charts and selectable SVG region maps. Dedicated
display bounds allow 40 chart points and 50 regions with bounded geometry;
existing Core execution and data limits remain unchanged. These primitives do
not yet implement Gym reports or chat widgets.

SDK 2.11 adds six bounded passive screenshot roles for Market galleries. The
clean snapshot records the exact committed SDK source revision.

SDK 2.12 raises only bounded native presentation capacity: 1,536 expressions,
4,096 expanded nodes and 16,384 evaluation steps. Core transaction, input,
result and query limits remain unchanged.

SDK 2.13 adds the standard creation-only `initialAgent` profile. Publishers
provide bounded name, role and instructions only; Anvil owns initial App-only
authority and the durable creation receipt. App lifecycle operations never
manage the created agent.

SDK 2.14 adds optional primary navigation visibility and targeted form source
refresh. Gym uses one aggregate workout read and manually requested history;
unchanged autosave forms produce no writes. Core authority and data bounds stay
unchanged.

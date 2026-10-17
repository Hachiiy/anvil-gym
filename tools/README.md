# Standalone public App SDK

`sdk/` contains the Apache-2.0 Anvil App author profile 2.4.0 source distribution.
It includes typed native definition builders, package/archive validation,
static conformance, the author-only TypeScript compiler/CLI and their bounded
App contract dependencies. It contains no server, deployment configuration,
credentials or application records.
The author CLI includes owner-approved pairing, private target storage and the
local watch/build/upload workflow. These author tools never enter installed Apps.

`sdk/snapshot.json` records the committed source revision and SHA-256 of all 46
exported tool files. This SDK 2.4.0 snapshot was refreshed from a clean committed
product export. It raises the native manifest budget to 2 MiB and 128,000 JSON
nodes; retained Core data JSON defaults remain 512 KiB and 32,000 nodes, and other
Core input/result/record/intermediate limits are unchanged. Imports are relocated
within this portable distribution;
unrelated product policies are excluded. `npm run check` verifies those hashes.
Third-party dependencies are pinned in the SDK manifest and root npm lockfile.

These tools run only during explicit local author commands. They are excluded
from distributed App archives. Validation of an installed package never runs
the compiler, imports publisher source or installs npm packages.

See [sdk/LICENSE](sdk/LICENSE).

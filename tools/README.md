# Standalone public App SDK

`sdk/` contains the Apache-2.0 Anvil App author profile 2.0.0 source distribution.
It includes typed native definition builders, package/archive validation,
static conformance, the author-only TypeScript compiler/CLI and their bounded
App contract dependencies. It contains no server, deployment configuration,
credentials or application records.

`sdk/snapshot.json` records the committed source revision and SHA-256 of every
exported tool file. Imports are relocated within this portable distribution;
unrelated product policies are excluded. `npm run check` verifies those hashes.
Third-party dependencies are pinned in the SDK manifest and root npm lockfile.

These tools run only during explicit local author commands. They are excluded
from distributed App archives. Validation of an installed package never runs
the compiler, imports publisher source or installs npm packages.

See [sdk/LICENSE](sdk/LICENSE).

# Standalone App author tools

This directory vendors the Apache-2.0 Anvil App author profile 1 tools needed
to validate, compile and package Gym without a private workspace dependency.
It includes package/archive validation, the CLI and their bounded App contract
dependencies. It contains no Anvil server, deployment configuration or data.

Source imports have been relocated to this standalone directory. The App
limits are the corresponding named policy from the source profile; unrelated
product policies are excluded. `snapshot.json` pins every included source file
by SHA-256. Keep this snapshot synchronized when the author profile changes.

These tools run only during explicit local author commands. They are excluded
from the distributed Gym App archive, and never execute as publisher server code.
The CLI's third-party dependencies are declared in the root package manifest.

See [LICENSE](LICENSE).

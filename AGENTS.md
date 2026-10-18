# Gym contributor rules

- This is the public, standalone source repository for the Gym App.
- Include only portable product code, documentation and fictional examples.
  Never include personal records, private deployment details, credentials,
  unrelated projects, runtime exports or local paths in committed material.
- Gym is a standard declarative Anvil App. Native view definitions use Anvil's
  shared Angular components; no publisher scripts, HTML, CSS or iframe execute
  in the installed App. Declared Core actions own persistent business behavior.
  Do not add publisher server code, private Anvil workspace dependencies or
  special installation/authorization bypasses.
- Keep maintained code files under 500 physical lines. Use cohesive modules.
- Use English source, UI and documentation. Reuse the host design contract.
- Run focused checks for changed behavior. Use fictional offline fixtures;
  never start paid model calls or install the App into a personal workspace as
  part of verification.
- Publish only reviewed immutable standard releases. Catalog publication must
  not install Gym or start an installation review.

- Keep the interface minimal and intuitive: concise labels, useful data and clear
  actions. Put explanations in contextual help or documentation, not persistent
  introductory paragraphs. Preserve meaningful units, status and error feedback.
- Do not add workout, rest or countdown timers. Explicit duration measurements
  remain supported for exercises such as cardio.

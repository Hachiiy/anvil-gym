import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sourceMuscles, starterCatalog } from "./catalog.mjs";

export async function checkCatalog() {
  const directory = new URL("../data/", import.meta.url);
  const provenance = JSON.parse(
    await readFile(new URL("starter-catalog.provenance.json", directory)),
  );
  const entries = await readFile(new URL("starter-catalog.json", directory));
  const license = await readFile(
    new URL("free-exercise-db-LICENSE.txt", directory),
  );
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  if (
    provenance.license !== "Unlicense" ||
    !/^[a-f0-9]{40}$/.test(provenance.commit) ||
    hash(entries) !== provenance.selectedSha256 ||
    hash(license) !== provenance.licenseSha256
  )
    throw new Error(
      "Starter catalog provenance does not match the pinned files.",
    );
  const catalog = JSON.parse(entries);
  if (
    !Array.isArray(catalog) ||
    catalog.length !== provenance.selectedEntries ||
    new Set(catalog.map((entry) => entry.id)).size !== catalog.length ||
    catalog.some(
      (entry) =>
        !entry.id ||
        !entry.name ||
        !["strength", "cardio"].includes(entry.category) ||
        !Array.isArray(entry.primaryMuscles) ||
        !Array.isArray(entry.secondaryMuscles) ||
        Object.keys(entry).some(
          (field) => !provenance.retainedFields.includes(field),
        ),
    )
  )
    throw new Error("Starter catalog shape or source identities are invalid.");
  if (
    catalog.some((entry) =>
      [...entry.primaryMuscles, ...entry.secondaryMuscles].some(
        (label) => !Object.hasOwn(sourceMuscles, label),
      ),
    ) ||
    starterCatalog.length !== catalog.length
  )
    throw new Error(
      "Every source muscle label needs an explicit mapping or an unmapped declaration.",
    );
  return catalog.length;
}

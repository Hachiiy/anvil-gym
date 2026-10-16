import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { defaultMetrics } from "./metric-schema.mjs";

const authored = ({ version, ...definition }) => definition;
export const exerciseFixture = () => ({
  name: "Fixture press",
  category: "strength",
  equipment: "barbell",
  muscles: { primary: ["chest"], secondary: ["triceps"] },
  metrics: [defaultMetrics.repetitions, defaultMetrics.load].map(authored),
  instructions: "",
  archived: false,
});

// Authors provide a real, disposable Core adapter. This module is not a second
// interpreter and is never included in the distributed App archive.
export async function runExerciseScenarios(invoke) {
  const run = async (action, input, operationId = randomUUID()) =>
    invoke(action, input, operationId);
  const operationId = randomUUID();
  let value = exerciseFixture();
  const first = await run("create-exercise", { value }, operationId);
  assert.deepEqual(await run("create-exercise", { value }, operationId), first);
  let saved = first.value;
  assert.equal(saved.revision, 1);
  assert.deepEqual(
    saved.data.metrics.map((metric) => metric.version),
    [1, 1],
  );
  const original = structuredClone(saved);
  const update = async (nextValue, revision = saved.revision) => {
    const receipt = await run("update-exercise", {
      id: saved.id,
      revision,
      value: nextValue,
    });
    saved = receipt.value;
    return saved;
  };

  value.metrics[1].label = "External load";
  await update(value);
  assert.equal(saved.revision, 2);
  assert.equal(saved.data.metrics[1].version, 1);
  value.metrics[1].unit = "lb";
  await update(value);
  assert.equal(saved.data.metrics[1].version, 3);
  assert.equal(original.data.metrics[1].unit, "kg");
  value.metrics = value.metrics.slice(0, 1);
  await update(value);
  value.metrics.push(authored(defaultMetrics.load));
  await update(value);
  assert.equal(saved.data.metrics[1].version, 5);

  const fresh = await run("get-exercise", { id: saved.id });
  assert.deepEqual(fresh.value, saved);
  await assert.rejects(update({ ...value, name: "Stale edit" }, 1), {
    code: "revision-conflict",
  });
  assert.deepEqual((await run("get-exercise", { id: saved.id })).value, saved);
  for (const invalid of [
    { ...value, metrics: [value.metrics[0], value.metrics[0]] },
    { ...value, muscles: { primary: ["chest", "chest"], secondary: [] } },
    { ...value, muscles: { primary: ["chest"], secondary: ["chest"] } },
    { ...value, metrics: [{ ...value.metrics[0], minimum: 100, maximum: 10 }] },
    { ...value, metrics: [{ ...value.metrics[0], version: 999 }] },
  ])
    await assert.rejects(run("create-exercise", { value: invalid }), {
      code: "invalid-input",
    });

  await update({ ...value, archived: true });
  const active = await run("list-exercises", { archived: false });
  assert(!active.value.records.some((row) => row.id === saved.id));
  const archive = await run("list-exercises", { archived: true });
  assert(archive.value.records.some((row) => row.id === saved.id));

  const maximum = exerciseFixture();
  maximum.name = "Fixture custom measurements";
  maximum.metrics = Array.from({ length: 12 }, (_, index) => ({
    ...authored(defaultMetrics.repetitions),
    key: `count-${index}`,
    label: `Count ${index + 1}`,
  }));
  const bounded = await run("create-exercise", { value: maximum });
  assert.equal(bounded.value.data.metrics.length, 12);
  return {
    checks:
      "exercise creation, exact retry, metric meaning versions, stale edits, validation, archive and declared metric bound",
  };
}

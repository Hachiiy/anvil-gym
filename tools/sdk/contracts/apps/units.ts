import { z } from "zod";

export const appUnitSchema = z.enum([
  "kg",
  "g",
  "lb",
  "m",
  "km",
  "mi",
  "s",
  "min",
  "h",
]);
export type AppUnit = z.infer<typeof appUnitSchema>;
// Factors use kilograms, meters and seconds. Custom units remain opaque.
export const appUnits = Object.freeze({
  kg: { dimension: "mass", factor: 1 },
  g: { dimension: "mass", factor: 0.001 },
  lb: { dimension: "mass", factor: 0.45359237 },
  m: { dimension: "distance", factor: 1 },
  km: { dimension: "distance", factor: 1000 },
  mi: { dimension: "distance", factor: 1609.344 },
  s: { dimension: "duration", factor: 1 },
  min: { dimension: "duration", factor: 60 },
  h: { dimension: "duration", factor: 3600 },
});

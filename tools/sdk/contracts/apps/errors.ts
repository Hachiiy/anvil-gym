import { z } from "zod";

export const appErrorCodeSchema = z.enum([
  "invalid-package",
  "incompatible",
  "invalid-input",
  "invalid-result",
  "not-found",
  "forbidden",
  "unavailable",
  "revision-conflict",
  "operation-conflict",
  "limit-exceeded",
  "review-required",
  "consent-required",
  "dependency-unavailable",
  "uncertain-effect",
]);

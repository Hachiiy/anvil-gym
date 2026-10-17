import { z } from "zod";
import { appPlatformLimits as limits } from "../limits.js";
import { appDigestSchema, appKeySchema } from "./identity.js";
import { appJsonValueSchema } from "./json.js";
import { appJsonSchema } from "./json-schema.js";

export const appInstallationStateSchema = z.enum([
  "downloaded",
  "awaiting-review",
  "awaiting-consent",
  "setup-required",
  "active",
  "disabled",
  "updating",
  "blocked",
  "uninstalled",
]);
export const appJobStateSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "uncertain",
]);
export const appDatasetStateSchema = z.enum([
  "ready",
  "migrating",
  "retained",
  "recovery-blocked",
  "purged",
]);
export { appErrorCodeSchema } from "./errors.js";
export const appSourceSchema = z.strictObject({
  installationId: z.uuid(),
  table: appKeySchema,
  recordId: z.uuid(),
  revision: z.number().int().positive(),
});
export const appGrantSnapshotSchema = z.strictObject({
  installationId: z.uuid(),
  grantGeneration: z.number().int().positive(),
  installationGeneration: z.number().int().positive(),
});
export const appActionCallSchema = z.strictObject({
  operationId: z.uuid(),
  action: appKeySchema,
  input: appJsonValueSchema(limits.inputBytes),
});
export const appActionResultSchema = z.strictObject({
  operationId: z.uuid(),
  receiptId: z.uuid(),
  installationId: z.uuid(),
  packageDigest: appDigestSchema,
  action: appKeySchema,
  value: appJsonValueSchema(limits.resultBytes),
  sources: z.array(appSourceSchema).max(limits.queryScanRows),
  committedAt: z.iso.datetime(),
});
export const appToolSchema = z.strictObject({
  name: appKeySchema,
  description: z.string().max(300),
  inputSchema: appJsonSchema,
  outputSchema: appJsonSchema,
  annotations: z.strictObject({
    readOnlyHint: z.boolean(),
    destructiveHint: z.boolean(),
    openWorldHint: z.boolean(),
  }),
});
export const appWidgetSchema = z.strictObject({
  id: z.uuid(),
  installationId: z.uuid(),
  packageDigest: appDigestSchema,
  renderer: appKeySchema,
  mode: z.enum(["snapshot", "live"]),
  value: appJsonValueSchema(limits.resultBytes),
  fallback: z.string().min(1).max(8000),
  sources: z.array(appSourceSchema).max(limits.queryScanRows),
  observedAt: z.iso.datetime(),
});
export const appStateTransitions = {
  downloaded: ["awaiting-review", "blocked", "uninstalled"],
  "awaiting-review": ["awaiting-consent", "blocked", "uninstalled"],
  "awaiting-consent": ["setup-required", "active", "blocked", "uninstalled"],
  "setup-required": ["active", "disabled", "blocked", "uninstalled"],
  active: ["disabled", "updating", "blocked", "uninstalled"],
  disabled: ["active", "updating", "blocked", "uninstalled"],
  updating: ["active", "disabled", "blocked"],
  blocked: ["awaiting-review", "awaiting-consent", "disabled", "uninstalled"],
  uninstalled: ["awaiting-review"],
} as const;
export type AppInstallationState = z.infer<typeof appInstallationStateSchema>;
export type AppDatasetState = z.infer<typeof appDatasetStateSchema>;
export type AppJobState = z.infer<typeof appJobStateSchema>;
export type AppSource = z.infer<typeof appSourceSchema>;
export type AppGrantSnapshot = z.infer<typeof appGrantSnapshotSchema>;
export type AppActionCall = z.infer<typeof appActionCallSchema>;
export type AppActionResult = z.infer<typeof appActionResultSchema>;

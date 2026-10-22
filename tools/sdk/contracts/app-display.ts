import { z } from "zod";
import { appDigestSchema, appKeySchema } from "./apps/identity.js";
import { appJsonValueSchema } from "./apps/json.js";
import { appDisplayLimits } from "./limits.js";

// Routing/display metadata only; importing it must not load package validators.
export const appViewParamsBytes = appDisplayLimits.paramsBytes;
export const appViewParamsSchema = appJsonValueSchema(
  appViewParamsBytes,
).refine(
  (value) =>
    encodeURIComponent(JSON.stringify(value)).length <= appViewParamsBytes,
  "View parameters exceed the encoded URL budget.",
);
export const appViewIntentSchema = z.strictObject({
  intentId: z.uuid().toLowerCase(),
  appName: z.string().min(1).max(100).optional(),
  viewLabel: z.string().min(1).max(80).optional(),
  updated: z.boolean().optional(),
  installationId: z.uuid().toLowerCase(),
  packageDigest: appDigestSchema,
  target: z.enum(["installed", "preview"]),
  viewId: appKeySchema,
  params: appViewParamsSchema,
});
export type AppViewIntent = z.infer<typeof appViewIntentSchema>;

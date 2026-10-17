import { z } from "zod";
import { appPreviewLimits } from "../limits.js";
import { appDigestSchema } from "./identity.js";
import { appManifestSchema } from "./manifest.js";
import { appActionResultSchema } from "./protocol.js";

const id = z.uuid().toLowerCase();
const generation = z.number().int().positive();
export const appDevelopmentTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/);
export const appDevelopmentProjectSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9._-]+$/);
export const appPreviewOverviewSchema = z.strictObject({
  id,
  projectKey: appDevelopmentProjectSchema,
  revision: z.number().int().nonnegative(),
  generation,
  dataRevision: generation,
  datasetGeneration: generation,
  active: z.boolean(),
  expiresAt: z.iso.datetime(),
  packageDigest: appDigestSchema.nullable(),
});
export const appPreviewDetailsSchema = appPreviewOverviewSchema.extend({
  manifest: appManifestSchema.nullable(),
});
export const appPreviewListSchema = z.strictObject({
  previews: z.array(appPreviewOverviewSchema).max(appPreviewLimits.sessions),
});
export const appStartPairingSchema = z.strictObject({
  requestId: id,
  projectKey: appDevelopmentProjectSchema,
  credentialHash: appDigestSchema,
});
export const appPairingSchema = z.strictObject({
  id,
  projectKey: appDevelopmentProjectSchema,
  fingerprint: appDigestSchema,
  state: z.enum([
    "pending",
    "approved",
    "paired",
    "declined",
    "expired",
    "stopped",
  ]),
  expiresAt: z.iso.datetime(),
  previewId: id.nullable(),
});
export const appApprovePairingSchema = z.strictObject({
  fingerprint: appDigestSchema,
});
export const appPreviewGenerationSchema = z.strictObject({ generation });
export const appPreviewUploadQuerySchema = z.strictObject({
  generation: z.coerce.number().int().positive().max(2147483647),
  revision: z.coerce.number().int().positive().max(2147483647),
  mode: z.enum(["preserve", "reset"]),
});
// A missing retained receipt is not proof that an earlier action never committed.
export const appPreviewActionReceiptSchema = z.strictObject({
  result: appActionResultSchema.nullable(),
});
export const appPairingExchangeSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("pending"), expiresAt: z.iso.datetime() }),
  z.strictObject({ state: z.enum(["declined", "expired"]) }),
  z.strictObject({
    state: z.literal("paired"),
    preview: appPreviewOverviewSchema,
  }),
]);
export type AppPreviewOverview = z.infer<typeof appPreviewOverviewSchema>;
export type AppPreviewDetails = z.infer<typeof appPreviewDetailsSchema>;
export type AppStartPairing = z.infer<typeof appStartPairingSchema>;
export type AppPairing = z.infer<typeof appPairingSchema>;
export type AppPairingExchange = z.infer<typeof appPairingExchangeSchema>;

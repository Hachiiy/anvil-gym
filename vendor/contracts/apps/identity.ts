import { z } from "zod";
import { appPlatformLimits as limits } from "../limits.js";

export const appProfile = Object.freeze({
  manifest: "1.0",
  coreActionApi: 1,
  recipeFormat: 1,
  integrationAdapter: 1,
  designCssContract: 1,
  schemaDialect: "https://json-schema.org/draft/2020-12/schema",
  mcp: "2025-11-25",
  mcpApps: "2026-01-26",
  uiBridge: "anvil-app-ui/1",
});
export const appKeySchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const appFieldKeySchema = z
  .string()
  .min(1)
  .max(100)
  .refine((key) => !["__proto__", "prototype", "constructor"].includes(key));
export const appVersionSchema = z
  .string()
  .max(64)
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
  );
export const appDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const appPathSchema = z
  .string()
  .min(1)
  .max(limits.pathCharacters)
  .refine(
    (value) =>
      /^[a-zA-Z0-9._/-]+$/.test(value) &&
      value
        .split("/")
        .every(
          (part) =>
            part.length > 0 &&
            part !== "." &&
            part !== ".." &&
            !part.endsWith("."),
        ) &&
      !value.startsWith("/"),
    "Use an unambiguous relative package path.",
  );
export const appOriginProviderSchema = z.enum(["github", "bundled"]);
const githubOrigin = z.strictObject({
  provider: z.literal("github").optional(),
  repositoryId: z.number().int().positive().safe(),
  publisherId: z.number().int().positive().safe(),
});
const bundledOrigin = z.strictObject({
  provider: z.literal("bundled"),
  appId: z.number().int().positive().safe(),
  publisher: z.literal("anvil"),
});
export const appOriginSchema = z.union([githubOrigin, bundledOrigin]);
const releaseFields = {
  releaseId: z.number().int().positive().safe(),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/),
  immutable: z.literal(true),
  version: appVersionSchema,
};
const githubRelease = githubOrigin.extend(releaseFields);
const bundledRelease = bundledOrigin.extend(releaseFields);
export const appReleaseIdentitySchema = z.union([
  githubRelease,
  bundledRelease,
]);
export const appCompatibilitySchema = z.strictObject({
  coreActionApi: z.literal(1),
  recipeFormat: z.literal(1),
  integrationAdapter: z.literal(1),
  designCssContract: z.literal(1),
});
const descriptorFields = {
  schemaVersion: z.literal("1.0"),
  artifact: z.strictObject({
    name: appPathSchema.refine(
      (name) => !name.includes("/") && name.endsWith(".anvilapp"),
    ),
    sha256: appDigestSchema,
    bytes: z.number().int().positive().max(limits.archiveBytes),
  }),
  manifestSha256: appDigestSchema,
  assets: z
    .array(
      z.strictObject({
        path: appPathSchema,
        releaseName: appPathSchema.refine((path) => !path.includes("/")),
        sha256: appDigestSchema,
        bytes: z.number().int().positive().max(limits.catalogAssetBytes),
        mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]),
      }),
    )
    .max(2),
};
export const appReleaseDescriptorSchema = z.union([
  githubRelease.extend(descriptorFields),
  bundledRelease.extend(descriptorFields),
]);
export const appDiscoveryHintSchema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  packageKey: appKeySchema,
});
export type AppReleaseIdentity = z.infer<typeof appReleaseIdentitySchema>;
export type AppReleaseDescriptor = z.infer<typeof appReleaseDescriptorSchema>;
export type AppOrigin = z.infer<typeof appOriginSchema>;
export type AppOriginProvider = z.infer<typeof appOriginProviderSchema>;

export function appOriginCoordinates(origin: AppOrigin) {
  return "repositoryId" in origin
    ? {
        provider: "github" as const,
        id: origin.repositoryId,
        publisherId: origin.publisherId,
      }
    : { provider: "bundled" as const, id: origin.appId, publisherId: 1 };
}
export function appOriginKey(origin: AppOrigin) {
  const value = appOriginCoordinates(origin);
  return `${value.provider}:${value.id}`;
}

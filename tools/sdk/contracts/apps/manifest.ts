import { z } from "zod";
import { appPlatformLimits as limits, agentProfileLimits } from "../limits.js";
import {
  appCatalogImageRoles,
  appCompatibilitySchema,
  appKeySchema,
  appFieldKeySchema,
  appOriginSchema,
  appPathSchema,
  appVersionSchema,
} from "./identity.js";
import { appJsonSchema } from "./json-schema.js";
import { appRecipeSchema } from "./recipe.js";
import { nativeViewSchema } from "./native/view.js";

export const appCapabilitySchema = z
  .string()
  .max(140)
  .regex(
    /^(data\.[a-z][a-z0-9-]{0,63}\.(read|write)|integration\.[a-z][a-z0-9-]{0,63}\.request|dependency\.[a-z][a-z0-9-]{0,63}\.call|jobs\.dispatch|files\.(read|export)|widgets\.publish|media\.[a-z][a-z0-9-]{0,63})$/,
  );
export const appTableSchema = z.strictObject({
  name: appKeySchema,
  schemaVersion: z.number().int().positive(),
  schema: appJsonSchema.refine(
    (value) => value.type === "object",
    "Table records must be objects.",
  ),
  indexes: z
    .array(
      z.strictObject({
        fields: z.array(appFieldKeySchema).min(1).max(4),
        unique: z.boolean(),
      }),
    )
    .max(8),
  references: z
    .array(
      z.strictObject({
        field: appFieldKeySchema,
        table: appKeySchema,
        onDelete: z.literal("restrict"),
      }),
    )
    .max(16),
  retention: z.literal("until-owner-purge"),
});
export const appActionSchema = z.strictObject({
  name: appKeySchema,
  summary: z.string().min(1).max(300),
  inputSchema: appJsonSchema.refine((value) => value.type === "object"),
  resultSchema: appJsonSchema.refine((value) => value.type === "object"),
  capabilities: z.array(appCapabilitySchema).max(64),
  effect: z.enum(["read", "transaction", "external", "job"]),
  recipe: appRecipeSchema,
});
export const appManifestSchema = z.strictObject({
  schemaVersion: z.literal("2.0"),
  package: z.strictObject({
    key: appKeySchema,
    name: z.string().min(1).max(80),
    kind: z.enum(["app", "module"]),
    version: appVersionSchema,
    summary: z.string().min(1).max(200),
    description: z.string().max(8000),
    categories: z.array(appKeySchema).max(8),
    license: z.string().min(1).max(100),
  }),
  publisher: z.strictObject({ displayName: z.string().min(1).max(100) }),
  initialAgent: z
    .strictObject({
      name: z.string().trim().min(1).max(agentProfileLimits.maxNameCharacters),
      role: z.string().trim().min(1).max(agentProfileLimits.maxRoleCharacters),
      systemInstructions: z
        .string()
        .min(1)
        .max(agentProfileLimits.maxSystemInstructionsCharacters),
    })
    .optional(),
  compatibility: appCompatibilitySchema,
  assets: z
    .array(
      z.strictObject({
        path: appPathSchema,
        mediaType: z.enum([
          "application/json",
          "image/png",
          "image/jpeg",
          "image/webp",
          "text/plain",
        ]),
        role: z.enum([
          ...appCatalogImageRoles,
          "documentation",
          "fixture",
          "data",
        ]),
      }),
    )
    .max(limits.archiveFiles - 1),
  tables: z.array(appTableSchema).max(limits.tables),
  actions: z.array(appActionSchema).max(limits.actions),
  integrations: z
    .array(
      z.strictObject({
        id: appKeySchema,
        adapter: z.literal("https-json/1"),
        purpose: z.string().min(1).max(300),
        origin: z.url().refine((value) => {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            url.origin === value &&
            !url.username &&
            !url.password
          );
        }),
        path: z
          .string()
          .max(500)
          .regex(/^\/[a-zA-Z0-9/_-]*$/),
        method: z.enum(["GET", "POST"]),
        connection: appKeySchema.optional(),
        inputSchema: appJsonSchema,
        resultSchema: appJsonSchema,
      }),
    )
    .max(limits.integrations),
  schedules: z
    .array(
      z.strictObject({
        id: appKeySchema,
        action: appKeySchema,
        purpose: z.string().min(1).max(300),
        intervalSeconds: z
          .number()
          .int()
          .min(60)
          .max(365 * 86400),
        input: z.json(),
        defaultEnabled: z.literal(false),
      }),
    )
    .max(limits.schedules),
  ui: z.array(nativeViewSchema).max(limits.widgets),
  capabilities: z.array(appCapabilitySchema).max(128),
  dependencies: z
    .array(
      z.strictObject({
        key: appKeySchema,
        origin: appOriginSchema,
        minimumVersion: appVersionSchema,
        maximumMajorExclusive: z.number().int().positive().max(100000),
        kind: z.enum(["module", "app"]),
      }),
    )
    .max(limits.dependencies),
  dataSources: z
    .array(
      z.strictObject({
        dependency: appKeySchema,
        purpose: z.string().min(1).max(300),
        access: z.enum(["read", "write"]),
      }),
    )
    .max(limits.dependencies),
  migrations: z
    .array(
      z.strictObject({
        table: appKeySchema,
        fromVersion: z.number().int().positive(),
        toVersion: z.number().int().positive(),
        defaults: z.record(z.string().max(100), z.json()),
        renames: z.record(z.string().max(100), z.string().max(100)),
        remove: z.array(z.string().max(100)).max(limits.schemaProperties),
      }),
    )
    .max(64),
  fixtures: z
    .array(
      z.strictObject({
        action: appKeySchema,
        input: z.json(),
        expect: z.json(),
      }),
    )
    .max(limits.fixtures),
  modelClaims: z
    .array(
      z.strictObject({
        model: z.string().min(1).max(200),
        packageVersion: appVersionSchema,
        testedAt: z.iso.datetime(),
        scenarios: z.array(z.string().min(1).max(200)).min(1).max(32),
        result: z.enum(["passed", "partial", "failed"]),
        evidence: appPathSchema,
      }),
    )
    .max(16),
});
export type AppManifest = z.infer<typeof appManifestSchema>;
export type AppAction = z.infer<typeof appActionSchema>;
export type AppTable = z.infer<typeof appTableSchema>;

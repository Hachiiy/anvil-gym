import { z } from "zod";
import { appPlatformLimits } from "../../limits.js";
import { appKeySchema } from "../identity.js";
import { appJsonSchema } from "../json-schema.js";
import { nativeExpressionSchema } from "./expressions.js";
import { nativeNodeSchema } from "./nodes.js";
import { appJsonValueSchema } from "../json.js";
import { nativeLocalSequenceSchema } from "./events.js";

const object = appJsonSchema.refine(
  (schema) => schema.type === "object",
  "View parameters and state require closed object schemas.",
);
const nativeViewShape = z.strictObject({
  id: appKeySchema,
  label: z.string().min(1).max(80),
  surface: z.enum(["app", "widget"]),
  renderer: z.literal("native"),
  requiresComponents: z.record(appKeySchema, z.number().int().positive()),
  paramsSchema: object,
  state: z.strictObject({ schema: object, initial: z.json() }),
  forms: z
    .array(
      z.strictObject({
        id: appKeySchema,
        action: appKeySchema,
        initial: nativeExpressionSchema,
        commit: z.enum(["explicit", "autosave"]),
        onSuccess: nativeLocalSequenceSchema.optional(),
        onFailure: nativeLocalSequenceSchema.optional(),
      }),
    )
    .max(appPlatformLimits.nativeUi.forms),
  sources: z
    .array(
      z.strictObject({
        id: appKeySchema,
        action: appKeySchema,
        input: nativeExpressionSchema,
        refresh: z.enum(["open", "manual"]),
      }),
    )
    .max(appPlatformLimits.nativeUi.sources),
  root: nativeNodeSchema,
  dialogs: z
    .array(
      z.strictObject({
        id: appKeySchema,
        label: z.string().min(1).max(100),
        root: nativeNodeSchema,
      }),
    )
    .max(appPlatformLimits.nativeUi.dialogs),
  actions: z.array(appKeySchema).max(appPlatformLimits.actions),
});
export const nativeViewDefinitionSchema = nativeViewShape.omit({
  renderer: true,
  requiresComponents: true,
});
export type NativeViewDefinition = z.infer<typeof nativeViewDefinitionSchema>;

export const nativeViewSchema = appJsonValueSchema(
  appPlatformLimits.manifestBytes,
)
  .transform((value): unknown => value)
  .pipe(nativeViewShape);
export type NativeView = z.infer<typeof nativeViewSchema>;

import { z } from "zod";
import { appPlatformLimits } from "../../limits.js";
import { appKeySchema } from "../identity.js";
import {
  nativeExpressionSchema,
  nativeFieldPathSchema,
} from "./expressions.js";

// Completion handlers contain presentation effects only. They cannot recursively
// dispatch action sequences or manufacture actor/installation authority.
export const nativeLocalEventSchema = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("set-state"),
    path: nativeFieldPathSchema,
    value: nativeExpressionSchema,
  }),
  z.strictObject({
    op: z.literal("set-form"),
    form: appKeySchema,
    path: nativeFieldPathSchema,
    value: nativeExpressionSchema,
  }),
  z.strictObject({
    op: z.literal("navigate"),
    view: appKeySchema,
    params: nativeExpressionSchema,
  }),
  z.strictObject({
    op: z.enum(["open-dialog", "close-dialog"]),
    dialog: appKeySchema,
  }),
  z.strictObject({ op: z.literal("refresh-source"), source: appKeySchema }),
]);
export const nativeLocalSequenceSchema = z
  .array(nativeLocalEventSchema)
  .max(appPlatformLimits.nativeUi.eventSteps);
const completion = {
  onSuccess: nativeLocalSequenceSchema,
  onFailure: nativeLocalSequenceSchema,
};
export const nativeEventSchema = z.union([
  nativeLocalEventSchema,
  z.strictObject({
    op: z.literal("invoke"),
    action: appKeySchema,
    input: nativeExpressionSchema,
    ...completion,
  }),
  z.strictObject({
    op: z.literal("submit-form"),
    form: appKeySchema,
    ...completion,
  }),
  z.strictObject({
    op: z.literal("request-widget"),
    action: appKeySchema,
    input: nativeExpressionSchema,
    view: appKeySchema,
    ...completion,
  }),
]);
export const nativeEventSequenceSchema = z
  .array(nativeEventSchema)
  .max(appPlatformLimits.nativeUi.eventSteps);
export type NativeLocalEvent = z.infer<typeof nativeLocalEventSchema>;
export type NativeEvent = z.infer<typeof nativeEventSchema>;

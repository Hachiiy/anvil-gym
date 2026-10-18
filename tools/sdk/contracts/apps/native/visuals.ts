import { z } from "zod";
import { nativeVisualLimits as limits } from "../../limits.js";
import { appJsonSchema } from "../json-schema.js";

const label = z.string().min(1).max(160);
const number = z.number().min(-limits.magnitude).max(limits.magnitude);
const labels = z.array(label).max(limits.chartPoints);
const values = z.array(number).max(limits.chartPoints);
const region = z.strictObject({
  key: z.string().min(1).max(100),
  label,
  path: z.string().min(1).max(limits.pathCharacters),
  value: number.optional(),
});
const regions = z.array(region).max(limits.regions);
function shape(schema: z.ZodType) {
  const { $schema: _dialect, ...value } = z.toJSONSchema(schema);
  return appJsonSchema.parse(value);
}
export const nativeChartLabelsType = shape(labels);
export const nativeChartValuesType = shape(values);
export const nativeRegionsType = shape(regions);
export const nativeRegionSelectionType = shape(
  z.strictObject({ key: region.shape.key }),
);
export const nativeChartDataSchema = z
  .strictObject({ labels, values })
  .superRefine((data, context) => {
    if (data.labels.length !== data.values.length)
      context.addIssue({
        code: "custom",
        message: "Chart labels and values must match.",
      });
  });
export const nativeRegionsSchema = regions.superRefine((items, context) => {
  if (new Set(items.map((item) => item.key)).size !== items.length)
    context.addIssue({
      code: "custom",
      message: "Map region identities must be unique.",
    });
  if (
    items.some((item) => /[^MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]/.test(item.path))
  )
    context.addIssue({
      code: "custom",
      message: "Map regions accept SVG path geometry only.",
    });
});
export type NativeChartData = z.infer<typeof nativeChartDataSchema>;
export type NativeRegion = z.infer<typeof region>;

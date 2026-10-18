import { z } from "zod";
import { appPlatformLimits, nativeVisualLimits } from "../../limits.js";
import { appFieldKeySchema, appKeySchema, appPathSchema } from "../identity.js";
import {
  nativeBooleanSchema,
  nativeExpressionSchema,
  nativeFieldPathSchema,
  nativeTextSchema,
  nativeLabelSchema,
} from "./expressions.js";
import { nativeEventSequenceSchema } from "./events.js";

const base = { id: appKeySchema, visible: nativeBooleanSchema.optional() };
const gap = z.enum(["none", "small", "normal", "large"]);
const field = {
  form: appKeySchema,
  path: nativeFieldPathSchema,
  label: nativeLabelSchema,
  description: nativeTextSchema.optional(),
  disabled: nativeBooleanSchema.optional(),
};
const choice = z.strictObject({
  value: z.string().max(200),
  label: z.string().max(200),
});

function makeNativeNodeSchema<S extends z.ZodType>(child: S) {
  const containerNodeSchema = z.strictObject({
    ...base,
    component: z.enum(["page", "section", "stack", "row", "card"]),
    props: z.strictObject({
      gap: gap.optional(),
      label: z.string().max(200).optional(),
      align: z.enum(["start", "center", "end", "stretch"]).optional(),
      wrap: z.boolean().optional(),
    }),
    get children(): z.ZodArray<S> {
      return z.array(child).max(appPlatformLimits.nativeUi.nodes);
    },
  });
  const gridNodeSchema = z.strictObject({
    ...base,
    component: z.literal("grid"),
    props: z.strictObject({
      columns: z.number().int().min(1).max(4),
      gap: gap.optional(),
    }),
    get children(): z.ZodArray<S> {
      return z.array(child).max(appPlatformLimits.nativeUi.nodes);
    },
  });
  const formNodeSchema = z.strictObject({
    ...base,
    component: z.literal("form"),
    props: z.strictObject({ form: appKeySchema }),
    get children(): z.ZodArray<S> {
      return z.array(child).max(appPlatformLimits.nativeUi.nodes);
    },
  });
  const listNodeSchema = z.strictObject({
    ...base,
    component: z.literal("list"),
    props: z.strictObject({
      items: nativeExpressionSchema,
      as: appKeySchema,
      key: z.array(appFieldKeySchema).min(1).max(appPlatformLimits.schemaDepth),
      maxItems: z
        .number()
        .int()
        .positive()
        .max(appPlatformLimits.nativeUi.listItems),
    }),
    get template(): S {
      return child;
    },
  });
  const conditionNodeSchema = z.strictObject({
    ...base,
    component: z.literal("condition"),
    props: z.strictObject({ when: nativeExpressionSchema }),
    get then(): S {
      return child;
    },
    get else(): z.ZodOptional<S> {
      return child.optional();
    },
  });

  return z.discriminatedUnion("component", [
    containerNodeSchema,
    gridNodeSchema,
    z.strictObject({
      ...base,
      component: z.literal("text"),
      props: z.strictObject({
        text: nativeTextSchema,
        tone: z.enum(["normal", "muted", "danger"]).optional(),
      }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("heading"),
      props: z.strictObject({
        text: nativeTextSchema,
        level: z.number().int().min(1).max(3),
      }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("badge"),
      props: z.strictObject({
        text: nativeTextSchema,
        tone: z.enum(["neutral", "success", "danger"]).optional(),
      }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("button"),
      props: z.strictObject({
        label: z.string().min(1).max(100),
        tone: z.enum(["primary", "secondary", "ghost", "destructive"]),
        disabled: nativeBooleanSchema.optional(),
      }),
      onPress: nativeEventSequenceSchema,
    }),
    z.strictObject({
      ...base,
      component: z.literal("text-field"),
      props: z.strictObject({
        ...field,
        multiline: z.boolean().optional(),
        placeholder: z.string().max(200).optional(),
      }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("number-field"),
      props: z.strictObject({
        ...field,
        digits: z
          .number()
          .int()
          .min(0)
          .max(appPlatformLimits.decimalDigits)
          .optional(),
      }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("measurement-field"),
      props: z.strictObject({
        ...field,
        unit: nativeTextSchema,
        metricId: nativeTextSchema,
        metricVersion: nativeExpressionSchema,
      }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("checkbox"),
      props: z.strictObject(field),
    }),
    z.strictObject({
      ...base,
      component: z.literal("select"),
      props: z.strictObject({
        ...field,
        options: z.union([
          z.array(choice).max(appPlatformLimits.nativeUi.listItems),
          nativeExpressionSchema,
        ]),
      }),
    }),
    formNodeSchema,
    listNodeSchema,
    conditionNodeSchema,
    z.strictObject({
      ...base,
      component: z.literal("loading"),
      props: z.strictObject({ label: z.string().min(1).max(200) }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("error"),
      props: z.strictObject({ message: nativeTextSchema }),
      onRetry: nativeEventSequenceSchema,
    }),
    z.strictObject({
      ...base,
      component: z.literal("empty-state"),
      props: z.strictObject({
        title: nativeTextSchema,
        description: nativeTextSchema.optional(),
      }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("image"),
      props: z.strictObject({ asset: appPathSchema, alt: z.string().max(500) }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("statistic"),
      props: z.strictObject({
        label: nativeTextSchema,
        value: nativeExpressionSchema,
        unit: nativeTextSchema.optional(),
      }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("chart"),
      props: z.strictObject({
        label: nativeLabelSchema,
        kind: z.enum(["line", "bar"]),
        labels: nativeExpressionSchema,
        values: nativeExpressionSchema,
        unit: nativeTextSchema.optional(),
      }),
    }),
    z.strictObject({
      ...base,
      component: z.literal("region-map"),
      props: z.strictObject({
        label: nativeLabelSchema,
        width: z.number().positive().max(nativeVisualLimits.extent),
        height: z.number().positive().max(nativeVisualLimits.extent),
        regions: nativeExpressionSchema,
        selected: nativeTextSchema.optional(),
        disabled: nativeBooleanSchema.optional(),
      }),
      onSelect: nativeEventSequenceSchema,
    }),
    z.strictObject({
      ...base,
      component: z.literal("divider"),
      props: z.strictObject({}),
    }),
  ]);
}

// Infer every public property from the schemas, replacing only recursive edges.
type NativeChildren<Node> = Node extends unknown
  ? {
      [Key in keyof Node]: Key extends "children"
        ? NativeNode[]
        : Key extends "template" | "then" | "else"
          ? NativeNode
          : Node[Key];
    }
  : never;
export type NativeNode = NativeChildren<
  z.infer<ReturnType<typeof makeNativeNodeSchema<z.ZodNever>>>
>;
export const nativeNodeSchema: z.ZodType<NativeNode> = makeNativeNodeSchema(
  z.lazy(() => nativeNodeSchema),
);
export type NativeComponent = NativeNode["component"];

export const nativeComponentMajors: Readonly<Record<NativeComponent, number>> =
  Object.freeze({
    page: 1,
    section: 1,
    stack: 1,
    row: 1,
    card: 1,
    grid: 1,
    text: 1,
    heading: 1,
    badge: 1,
    button: 1,
    "text-field": 1,
    "number-field": 1,
    "measurement-field": 1,
    checkbox: 1,
    select: 1,
    form: 1,
    list: 1,
    condition: 1,
    loading: 1,
    error: 1,
    "empty-state": 1,
    image: 1,
    statistic: 1,
    chart: 1,
    "region-map": 1,
    divider: 1,
  });

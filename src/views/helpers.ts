import type { NativeNode, NativeViewDefinition } from "@anvil/app-sdk/author";

export type Binding = NativeViewDefinition["sources"][number]["input"];
export type FieldPath = Extract<
  NativeNode,
  { component: "text-field" }
>["props"]["path"];
export const empty = {
  type: "object" as const,
  properties: {},
  required: [],
  additionalProperties: false as const,
};
export const literal = (
  value: Extract<Binding, { op: "literal" }>["value"],
): Binding => ({ op: "literal", value });
export const ref = (
  scope: Extract<Binding, { op: "ref" }>["scope"],
  path: FieldPath = [],
  name?: string,
): Binding => ({ op: "ref", scope, path, ...(name ? { name } : {}) });
export const object = (fields: Record<string, Binding>): Binding => ({
  op: "object",
  fields,
});
export const heading = (id: string, text: string, level = 2): NativeNode => ({
  id,
  component: "heading",
  props: { text, level },
});
export const text = (id: string, value: string | Binding): NativeNode => ({
  id,
  component: "text",
  props: { text: value, tone: "muted" },
});
export const stack = (id: string, children: NativeNode[]): NativeNode => ({
  id,
  component: "stack",
  props: { gap: "normal" },
  children,
});
export const grid = (id: string, children: NativeNode[]): NativeNode => ({
  id,
  component: "grid",
  props: { columns: 2, gap: "normal" },
  children,
});
export const field = (
  id: string,
  label: string,
  path: FieldPath,
  multiline = false,
): NativeNode => ({
  id,
  component: "text-field",
  props: { label, form: "exercise", path, multiline },
});
export const select = (
  id: string,
  label: string,
  path: FieldPath,
  options: readonly (string | { value: string; label: string })[],
): NativeNode => ({
  id,
  component: "select",
  props: {
    label,
    form: "exercise",
    path,
    options: options.map((option) =>
      typeof option === "string" ? { value: option, label: option } : option,
    ),
  },
});
export const number = (
  id: string,
  label: string,
  path: FieldPath,
): NativeNode => ({
  id,
  component: "number-field",
  props: { label, form: "exercise", path },
});
export const checkbox = (
  id: string,
  label: string,
  path: FieldPath,
): NativeNode => ({
  id,
  component: "checkbox",
  props: { label, form: "exercise", path },
});
export const button = (
  id: string,
  label: string,
  onPress: Extract<NativeNode, { component: "button" }>["onPress"],
  tone: "primary" | "secondary" | "ghost" = "secondary",
  disabled?: boolean | Binding,
): NativeNode => ({
  id,
  component: "button",
  props: { label, tone, ...(disabled === undefined ? {} : { disabled }) },
  onPress,
});
export const navigate = (
  view: string,
  params: Binding = literal({}),
): Extract<NativeNode, { component: "button" }>["onPress"] => [
  { op: "navigate", view, params },
];

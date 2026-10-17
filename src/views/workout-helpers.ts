import {
  defineView,
  type NativeNode,
  type NativeViewDefinition,
} from "@anvil/app-sdk/author";
import {
  empty,
  literal,
  object,
  ref,
  type Binding,
  type FieldPath,
} from "./helpers.js";

type ViewInput = Omit<
  NativeViewDefinition,
  "state" | "dialogs" | "surface" | "paramsSchema"
> & { entity?: boolean };
export function workoutView({ entity = false, ...input }: ViewInput) {
  return defineView({
    ...input,
    surface: "app",
    paramsSchema: entity
      ? {
          ...empty,
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } },
          required: ["id"],
        }
      : empty,
    state: { schema: empty, initial: {} },
    dialogs: [],
  });
}
export const source = (id: string, action: string, input: Binding) => ({
  id,
  action,
  input,
  refresh: "open" as const,
});
export const paramsId = () => object({ id: ref("params", ["id"]) });
export const page = (id: string, children: NativeNode[]): NativeNode => ({
  id,
  component: "page",
  props: { gap: "large" },
  children,
});
export const formField = (
  id: string,
  label: string,
  form: string,
  path: FieldPath,
  multiline = false,
): NativeNode => ({
  id,
  component: "text-field",
  props: { label, form, path, multiline },
});
export const revisionHook = (
  form: string,
): NonNullable<NativeViewDefinition["forms"][number]["onSuccess"]> => [
  {
    op: "set-form",
    form,
    path: ["revision"],
    value: ref("event", ["revision"]),
  },
];
export const entityLink = (path: FieldPath, name: string) =>
  object({ id: ref("source", path, name) });
export const active = {
  op: "equal" as const,
  left: ref("source", ["data", "status"], "workout"),
  right: literal("active"),
};
export const setLabel = (item = "set"): Binding => ({
  op: "concat",
  left: literal("Set "),
  right: {
    op: "format",
    format: "number",
    value: {
      op: "add",
      left: ref("item", ["data", "position"], item),
      right: literal(1),
    },
    digits: 0,
  },
});

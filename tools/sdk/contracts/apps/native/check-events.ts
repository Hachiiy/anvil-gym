import type { AppJsonSchema } from "../json-schema.js";
import type { NativeEvent } from "./events.js";
import type { NativeBindingScope } from "./inference.js";
import { nativePathType } from "./inference.js";
import { NativeCheckContext } from "./check-context.js";

const failure: AppJsonSchema = {
  type: "object",
  properties: {
    code: { type: "string", maxLength: 100 },
    message: { type: "string", maxLength: 1000 },
  },
  required: ["code", "message"],
  additionalProperties: false,
};
export function checkNativeEvents(
  events: readonly NativeEvent[],
  scope: NativeBindingScope,
  check: NativeCheckContext,
  label: string,
) {
  for (const [index, event] of events.entries()) {
    const at = `${label}[${index}]`;
    const infer = (value: Parameters<NativeCheckContext["expression"]>[0]) =>
      check.expression(value, scope, at);
    switch (event.op) {
      case "set-state":
      case "set-form": {
        const root =
          event.op === "set-state" ? scope.state : scope.forms.get(event.form);
        if (!root) {
          check.fail(at, "Unknown target form.");
          break;
        }
        const target = nativePathType(
          root,
          event.path,
          scope,
          (message) => check.fail(at, message),
          true,
        );
        check.assign(infer(event.value), target, at);
        break;
      }
      case "navigate": {
        const view = check.views.find((view) => view.id === event.view);
        if (!view) check.fail(at, "Unknown navigation view.");
        check.assign(infer(event.params), view?.paramsSchema, at);
        break;
      }
      case "open-dialog":
      case "close-dialog":
        if (!check.view.dialogs.some((dialog) => dialog.id === event.dialog))
          check.fail(at, "Unknown dialog.");
        break;
      case "refresh-source":
        if (!scope.sources.has(event.source))
          check.fail(at, "Unknown data source.");
        break;
      case "invoke":
      case "request-widget":
      case "submit-form": {
        const form =
          event.op === "submit-form"
            ? check.view.forms.find((form) => form.id === event.form)
            : undefined;
        const action =
          event.op === "submit-form"
            ? form && check.action(form.action, at)
            : check.action(event.action, at);
        if (event.op === "submit-form" && !form)
          check.fail(at, "Unknown submitted form.");
        if (event.op !== "submit-form")
          check.assign(infer(event.input), action?.inputSchema, at);
        if (event.op === "request-widget") {
          if (
            !check.views.some(
              (view) => view.id === event.view && view.surface === "widget",
            )
          )
            check.fail(at, "Publication requires a declared widget view.");
          if (
            !action?.capabilities.includes("widgets.publish") ||
            !check.definition.capabilities.includes("widgets.publish")
          )
            check.fail(
              at,
              "Widget publication requires its declared action capability.",
            );
        }
        checkNativeEvents(
          event.onSuccess,
          { ...scope, event: action?.resultSchema },
          check,
          `${at}.onSuccess`,
        );
        checkNativeEvents(
          event.onFailure,
          { ...scope, event: failure },
          check,
          `${at}.onFailure`,
        );
        break;
      }
    }
  }
}

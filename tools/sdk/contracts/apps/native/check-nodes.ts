import { appPlatformLimits } from "../../limits.js";
import { nativePathType, type NativeBindingScope } from "./inference.js";
import type { NativeNode, NativeComponent } from "./nodes.js";
import { nativeComponentMajors } from "./nodes.js";
import { NativeCheckContext } from "./check-context.js";
import { checkNativeEvents } from "./check-events.js";
import {
  nativeChartLabelsType,
  nativeChartValuesType,
  nativeRegionsType,
  nativeRegionSelectionType,
} from "./visuals.js";

export function checkNativeTree(check: NativeCheckContext) {
  const identities = new Set<string>();
  const components = new Set<NativeComponent>();
  let count = 0;
  function walk(
    node: NativeNode,
    scope: NativeBindingScope,
    depth: number,
  ): number {
    const at = `node:${node.id}`;
    if (
      ++count > appPlatformLimits.nativeUi.nodes ||
      depth > appPlatformLimits.nativeUi.depth
    ) {
      check.fail(at, "Native node structural budget exceeded.");
      return 0;
    }
    if (identities.has(node.id)) check.fail(at, "Duplicate node identity.");
    identities.add(node.id);
    components.add(node.component);
    const expr = (
      value: Parameters<NativeCheckContext["expression"]>[0],
      label = at,
    ) => check.expression(value, scope, label);
    if (typeof node.visible === "object")
      check.expect(expr(node.visible), ["boolean"], `${at}.visible`);
    if ("children" in node) {
      if (node.component === "form" && !scope.forms.has(node.props.form))
        check.fail(at, "Unknown form binding.");
      return (
        1 +
        node.children.reduce(
          (total, child) => total + walk(child, scope, depth + 1),
          0,
        )
      );
    }
    switch (node.component) {
      case "chart":
        check.assign(
          expr(node.props.labels),
          nativeChartLabelsType,
          `${at}.labels`,
        );
        check.assign(
          expr(node.props.values),
          nativeChartValuesType,
          `${at}.values`,
        );
        for (const value of [node.props.label, node.props.unit])
          if (typeof value === "object")
            check.expect(expr(value), ["string"], at);
        break;
      case "region-map":
        check.assign(
          expr(node.props.regions),
          nativeRegionsType,
          `${at}.regions`,
        );
        for (const value of [node.props.label, node.props.selected])
          if (typeof value === "object")
            check.expect(expr(value), ["string"], at);
        if (typeof node.props.disabled === "object")
          check.expect(
            expr(node.props.disabled),
            ["boolean"],
            `${at}.disabled`,
          );
        checkNativeEvents(
          node.onSelect,
          { ...scope, event: nativeRegionSelectionType },
          check,
          `${at}.onSelect`,
        );
        break;
      case "list": {
        const list = expr(node.props.items);
        check.expect(list, ["array"], at);
        if (!list?.items) {
          check.fail(at, "A list requires known item fields.");
          return 1;
        }
        if (scope.items.has(node.props.as))
          check.fail(at, "Repeated item binding shadows an outer item.");
        const nested = {
          ...scope,
          items: new Map([
            ...scope.items,
            [
              node.props.as,
              {
                schema: list.items,
                maxItems: Math.min(
                  list.maxItems ?? node.props.maxItems,
                  node.props.maxItems,
                ),
              },
            ],
          ]),
        };
        const key = nativePathType(
          list.items,
          node.props.key,
          nested,
          (message) => check.fail(at, message),
        );
        check.expect(key, ["string", "integer"], `${at}.key`);
        return 1 + node.props.maxItems * walk(node.template, nested, depth + 1);
      }
      case "condition": {
        check.expect(expr(node.props.when), ["boolean"], `${at}.when`);
        return (
          1 +
          Math.max(
            walk(node.then, scope, depth + 1),
            node.else ? walk(node.else, scope, depth + 1) : 0,
          )
        );
      }
      case "button":
        if (typeof node.props.disabled === "object")
          check.expect(
            expr(node.props.disabled),
            ["boolean"],
            `${at}.disabled`,
          );
        checkNativeEvents(node.onPress, scope, check, `${at}.onPress`);
        break;
      case "text-field":
      case "number-field":
      case "measurement-field":
      case "checkbox":
      case "select": {
        const form = scope.forms.get(node.props.form);
        if (!form) {
          check.fail(at, "Unknown field form.");
          break;
        }
        const target = nativePathType(
          form,
          node.props.path,
          scope,
          (message) => check.fail(at, message),
          true,
        );
        const types =
          node.component === "checkbox"
            ? (["boolean"] as const)
            : node.component === "text-field" || node.component === "select"
              ? (["string"] as const)
              : (["integer", "number"] as const);
        check.expect(target, [...types], at);
        if (typeof node.props.label === "object")
          check.expect(expr(node.props.label), ["string"], `${at}.label`);
        if (typeof node.props.description === "object")
          check.expect(
            expr(node.props.description),
            ["string"],
            `${at}.description`,
          );
        if (typeof node.props.disabled === "object")
          check.expect(
            expr(node.props.disabled),
            ["boolean"],
            `${at}.disabled`,
          );
        if (node.component === "measurement-field") {
          for (const value of [node.props.unit, node.props.metricId])
            if (typeof value === "object")
              check.expect(expr(value), ["string"], at);
          check.expect(
            expr(node.props.metricVersion),
            ["integer"],
            `${at}.metricVersion`,
          );
        }
        if (node.component === "select" && !Array.isArray(node.props.options)) {
          const options = expr(node.props.options);
          check.expect(options, ["array"], `${at}.options`);
          if (!options?.items)
            check.fail(at, "Select options require known item fields.");
          else
            check.assign(
              options.items,
              {
                type: "object",
                properties: {
                  value: { type: "string", maxLength: 200 },
                  label: { type: "string", maxLength: 200 },
                },
                required: ["value", "label"],
                additionalProperties: false,
              },
              `${at}.options`,
            );
        }
        break;
      }
      case "image":
        if (
          !check.definition.assets.some(
            (asset) =>
              asset.path === node.props.asset &&
              ["image/png", "image/jpeg", "image/webp"].includes(
                asset.mediaType,
              ),
          )
        )
          check.fail(at, "Unknown or non-passive image asset.");
        break;
      case "error":
        if (typeof node.props.message === "object")
          check.expect(expr(node.props.message), ["string"], at);
        checkNativeEvents(node.onRetry, scope, check, `${at}.onRetry`);
        break;
      case "statistic":
        check.expect(
          expr(node.props.value),
          ["integer", "number"],
          `${at}.value`,
        );
        for (const value of [node.props.label, node.props.unit])
          if (typeof value === "object")
            check.expect(expr(value), ["string"], at);
        break;
      case "text":
      case "heading":
      case "badge":
        if (typeof node.props.text === "object")
          check.expect(expr(node.props.text), ["string"], at);
        break;
      case "empty-state":
        for (const value of [node.props.title, node.props.description])
          if (typeof value === "object")
            check.expect(expr(value), ["string"], at);
        break;
    }
    return 1;
  }
  const cost =
    walk(check.view.root, check.scope, 0) +
    check.view.dialogs.reduce(
      (total, dialog) => total + walk(dialog.root, check.scope, 0),
      0,
    );
  if (cost > appPlatformLimits.nativeUi.renderedNodes)
    check.fail("root", "Expanded node budget exceeded.");
  for (const name of components)
    if (check.view.requiresComponents[name] !== nativeComponentMajors[name])
      check.fail(
        "requiresComponents",
        `Unsupported or missing component major: ${name}.`,
      );
  for (const name of Object.keys(check.view.requiresComponents))
    if (![...components].some((component) => component === name))
      check.fail(
        "requiresComponents",
        `Component requirement is not used: ${name}.`,
      );
}

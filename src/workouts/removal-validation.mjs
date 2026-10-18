import { object } from "../schema.mjs";
import { literal, readAction, result } from "../expressions.mjs";
import { get, query, readCaps } from "./shared.mjs";
import {
  expectCollection,
  expectParent,
  removalInput,
} from "./removal-shared.mjs";

export const removalValidationActions = [
  ...[
    { scope: "set", parent: "occurrence", child: "set", field: "occurrenceId" },
    {
      scope: "occurrence",
      parent: "session",
      child: "occurrence",
      field: "sessionId",
    },
    { scope: "block", parent: "session", child: "block", field: "sessionId" },
  ].map(({ scope, parent, child, field }) => ({
    ...readAction(
      `validate-${scope}-removal`,
      "Check the observed parent and remaining records before Undo",
      removalInput,
      [
        get("removal", "removal", { op: "input", path: ["removalId"] }),
        get("parent", parent, result("removal", "data", "contextId")),
        expectParent("parent"),
        query(
          "current",
          child,
          field,
          result(
            "removal",
            "data",
            scope === "set" ? "contextId" : "sessionId",
          ),
          scope === "set" ? 10 : 50,
        ),
        expectCollection("current"),
        ...(scope === "occurrence"
          ? [
              query(
                "blocks",
                "block",
                "sessionId",
                result("removal", "data", "sessionId"),
                50,
              ),
              expectCollection("blocks", "remainingBlocks"),
            ]
          : []),
        ...(scope === "block"
          ? [
              query(
                "occurrences",
                "occurrence",
                "sessionId",
                result("removal", "data", "sessionId"),
                50,
              ),
              expectCollection("occurrences", "remainingOccurrences"),
            ]
          : []),
      ],
      object({}),
      literal({}),
    ),
    capabilities: readCaps(
      "removal",
      parent,
      child,
      ...(scope === "block"
        ? ["occurrence"]
        : scope === "occurrence"
          ? ["block"]
          : []),
    ),
  })),
];

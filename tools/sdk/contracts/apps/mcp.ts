import { z } from "zod";
import { appToolSchema, appActionResultSchema } from "./protocol.js";
import { appManifestSchema } from "./manifest.js";
import { appDigestSchema, appProfile } from "./identity.js";

export const appMcpToolSchema = appToolSchema;
export const appPeerSchema = z.strictObject({
  protocolVersion: z.literal(appProfile.mcp),
});

export function appMcpTools(
  input: z.infer<typeof appManifestSchema>,
  digest: string,
  peer: z.infer<typeof appPeerSchema>,
) {
  appDigestSchema.parse(digest);
  appPeerSchema.parse(peer);
  return input.actions.map((action) => {
    return appMcpToolSchema.parse({
      name: action.name,
      description: action.summary,
      inputSchema: action.inputSchema,
      outputSchema: action.resultSchema,
      annotations: {
        readOnlyHint: action.effect === "read",
        destructiveHint: action.effect !== "read",
        openWorldHint: action.effect === "external",
      },
    });
  });
}
export function appMcpResult(input: z.infer<typeof appActionResultSchema>) {
  const result = appActionResultSchema.parse(input);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result.value) }],
    structuredContent: result.value,
    isError: false,
    _meta: {
      anvil: {
        operationId: result.operationId,
        receiptId: result.receiptId,
        packageDigest: result.packageDigest,
        sources: result.sources,
      },
    },
  };
}

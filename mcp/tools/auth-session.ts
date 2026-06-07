import { verifyBearer } from "../../auth/bearer.ts";
import { authSessionScopes } from "../../auth/scopes.ts";
import { readOnlyToolAnnotations } from "../tool-annotations.ts";
import { emptyInputSchema, objectSchema, stringArraySchema, stringSchema } from "../tool-schemas.ts";
import type { McpTool } from "../tool-types.ts";

export const authSessionTool: McpTool = {
  name: "auth.session",
  title: "Auth Session",
  description: "Return authenticated token session metadata.",
  inputSchema: emptyInputSchema(),
  outputSchema: objectSchema({
    subject: stringSchema(),
    clientId: stringSchema(),
    audience: stringSchema(),
    scopes: stringArraySchema(),
  }),
  annotations: readOnlyToolAnnotations(),
  requiredScopes: [...authSessionScopes],
  run: async (context) => {
    const claims = verifyBearer(context.config, context.authorization, context.config.mcpResource, authSessionScopes);
    const structuredContent = {
      subject: claims.sub,
      clientId: claims.client_id,
      audience: claims.aud,
      scopes: claims.scope.split(/\s+/).filter(Boolean),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(structuredContent) }],
      structuredContent,
    };
  },
};

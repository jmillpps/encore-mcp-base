import { verifyBearer } from "../../auth/bearer.ts";
import { emptyInputSchema, objectSchema, stringArraySchema, stringSchema } from "../tool-schemas.ts";
import type { McpTool } from "../tool-types.ts";

const authSessionScopes = ["openid"];

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
  securitySchemes: [{ type: "oauth2", scopes: [...authSessionScopes] }],
  requiredScopes: [...authSessionScopes],
  run: async (context) => {
    const claims = verifyBearer(context.config, context.authorization, context.config.mcpResource, authSessionScopes);
    return {
      content: [{ type: "text", text: claims.sub }],
      structuredContent: {
        subject: claims.sub,
        clientId: claims.client_id,
        audience: claims.aud,
        scopes: claims.scope.split(/\s+/).filter(Boolean),
      },
    };
  },
};

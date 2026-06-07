import { verifyBearer } from "../../auth/bearer.ts";
import { identityProfileScopes } from "../../auth/scopes.ts";
import { staticUser } from "../../auth/static-user.ts";
import { readOnlyToolAnnotations } from "../tool-annotations.ts";
import { booleanSchema, emptyInputSchema, objectSchema, stringSchema } from "../tool-schemas.ts";
import type { McpTool, ToolContext } from "../tool-types.ts";

export const identityProfileTool: McpTool = {
  name: "identity.profile",
  title: "Identity Profile",
  description: "Use this when ChatGPT needs the authenticated user's OpenID Connect profile.",
  inputSchema: emptyInputSchema(),
  outputSchema: objectSchema({
    sub: stringSchema(),
    given_name: stringSchema(),
    family_name: stringSchema(),
    name: stringSchema(),
    preferred_username: stringSchema(),
    email: stringSchema(),
    email_verified: booleanSchema(),
  }),
  annotations: readOnlyToolAnnotations(),
  invocation: { invoking: "Reading identity profile", invoked: "Identity profile ready" },
  requiredScopes: [...identityProfileScopes],
  run: async (context) => identityProfile(context),
};

async function identityProfile(context: ToolContext): Promise<Record<string, unknown>> {
  verifyBearer(context.config, context.authorization, context.config.mcpResource, identityProfileScopes);
  return { content: [{ type: "text", text: JSON.stringify(staticUser) }], structuredContent: staticUser };
}

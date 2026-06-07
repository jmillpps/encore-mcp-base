import { verifyBearer } from "../../auth/bearer.ts";
import { identityProfileScopes } from "../../auth/scopes.ts";
import { userProfileFromClaims } from "../../auth/static-user.ts";
import { readOnlyToolAnnotations } from "../tool-annotations.ts";
import { booleanSchema, emptyInputSchema, objectSchema, stringSchema } from "../tool-schemas.ts";
import type { McpTool, ToolContext } from "../tool-types.ts";

export const identityProfileTool: McpTool = {
  name: "identity.profile",
  title: "Identity Profile",
  description: "Use this when ChatGPT needs the authenticated user's OpenID Connect profile.",
  inputSchema: emptyInputSchema(),
  outputSchema: objectSchema("Authenticated OpenID Connect profile.", {
    sub: stringSchema("Stable subject identifier for the authenticated user."),
    given_name: stringSchema("Given name for the authenticated user."),
    family_name: stringSchema("Family name for the authenticated user."),
    name: stringSchema("Full display name for the authenticated user."),
    preferred_username: stringSchema("Preferred username for the authenticated user."),
    email: stringSchema("Verified email address for the authenticated user."),
    email_verified: booleanSchema("Email verification status for the authenticated user."),
  }),
  annotations: readOnlyToolAnnotations(),
  invocation: { invoking: "Reading identity profile", invoked: "Identity profile ready" },
  requiredScopes: [...identityProfileScopes],
  run: async (context) => identityProfile(context),
};

async function identityProfile(context: ToolContext): Promise<Record<string, unknown>> {
  const claims = verifyBearer(context.config, context.authorization, context.config.mcpResource, identityProfileScopes);
  const user = userProfileFromClaims(claims);
  return { content: [{ type: "text", text: JSON.stringify(user) }], structuredContent: user };
}

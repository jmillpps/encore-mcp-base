import { verifyBearer } from "../../auth/bearer.ts";
import { identityProfileScopes } from "../../auth/scopes.ts";
import { userProfileFromClaims } from "../../auth/user-profile.ts";
import { toolUiResource } from "../app-ui.ts";
import { profileSummaryCardUri } from "../resources/profile-summary-card.ts";
import { readOnlyToolAnnotations } from "../tool-annotations.ts";
import { booleanSchema, emptyInputSchema, objectSchema, stringSchema } from "../tool-schemas.ts";
import type { McpTool, ToolContext } from "../tool-types.ts";

export const identityProfileCardTool: McpTool = {
  name: "identity.profile_card",
  title: "Identity Profile Card",
  description: "Use this when ChatGPT should render the authenticated user's OpenID Connect profile as an inline UI card.",
  inputSchema: emptyInputSchema(),
  outputSchema: objectSchema("Authenticated OpenID Connect profile for UI rendering.", {
    sub: stringSchema("Stable subject identifier for the authenticated user."),
    given_name: stringSchema("Given name for the authenticated user."),
    family_name: stringSchema("Family name for the authenticated user."),
    name: stringSchema("Full display name for the authenticated user."),
    preferred_username: stringSchema("Preferred username for the authenticated user."),
    email: stringSchema("Verified email address for the authenticated user."),
    email_verified: booleanSchema("Email verification status for the authenticated user."),
  }),
  annotations: readOnlyToolAnnotations(),
  invocation: { invoking: "Rendering identity profile", invoked: "Identity profile ready" },
  requiredScopes: [...identityProfileScopes],
  ui: toolUiResource(profileSummaryCardUri),
  run: async (context) => identityProfileCard(context),
};

async function identityProfileCard(context: ToolContext): Promise<Record<string, unknown>> {
  const claims = verifyBearer(context.config, context.authorization, context.config.mcpResource, identityProfileScopes);
  const structuredContent = userProfileFromClaims(claims);
  return { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent };
}

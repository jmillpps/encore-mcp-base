import type { ServiceConfig } from "../shared/config.ts";

export function wwwAuthenticate(config: ServiceConfig, scopes: string[]): string {
  const scope = scopes.join(" ");
  return `Bearer resource_metadata="${config.issuer}/.well-known/oauth-protected-resource", error="insufficient_scope", error_description="Authorization required", scope="${scope}"`;
}

export function authChallengeResult(config: ServiceConfig, scopes: string[]): Record<string, unknown> {
  return {
    content: [{ type: "text", text: "Authentication required." }],
    isError: true,
    _meta: { "mcp/www_authenticate": [wwwAuthenticate(config, scopes)] },
  };
}

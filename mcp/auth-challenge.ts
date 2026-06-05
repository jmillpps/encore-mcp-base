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

export function extractWwwAuthenticate(value: unknown): string[] | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const meta = (value as Record<string, unknown>)._meta;
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return undefined;
  const challenges = (meta as Record<string, unknown>)["mcp/www_authenticate"];
  if (!Array.isArray(challenges) || challenges.some((challenge) => typeof challenge !== "string")) return undefined;
  return challenges;
}

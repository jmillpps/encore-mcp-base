import type { ServiceConfig } from "../shared/config.ts";
import type { ServiceError } from "../shared/errors.ts";
import { protectedResourceMetadataUrl } from "../shared/mcp-resource.ts";

export function wwwAuthenticate(config: ServiceConfig, scopes: string[], error?: ServiceError): string {
  const scope = scopes.join(" ");
  const resourceMetadata = `resource_metadata="${protectedResourceMetadataUrl(config.mcpResource)}"`;
  const scopeValue = `scope="${scope}"`;
  if (error?.status === 403) return `Bearer error="insufficient_scope", ${resourceMetadata}, ${scopeValue}`;
  return `Bearer ${resourceMetadata}, ${scopeValue}`;
}

export function authChallengeResult(config: ServiceConfig, scopes: string[], error?: ServiceError): Record<string, unknown> {
  return {
    content: [{ type: "text", text: error?.status === 403 ? "Additional authorization scopes required." : "Authentication required." }],
    isError: true,
    _meta: { "mcp/www_authenticate": [wwwAuthenticate(config, scopes, error)] },
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

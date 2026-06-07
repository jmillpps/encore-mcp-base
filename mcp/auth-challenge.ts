import type { ServiceConfig } from "../shared/config.ts";
import type { ServiceError } from "../shared/errors.ts";
import { protectedResourceMetadataUrl } from "../shared/mcp-resource.ts";

export function wwwAuthenticate(config: ServiceConfig, scopes: string[], error?: ServiceError): string {
  const scope = scopes.join(" ");
  const challenge = challengeError(error);
  const parameters = [
    authParameter("error", challenge.error),
    authParameter("error_description", challenge.description),
    authParameter("resource_metadata", protectedResourceMetadataUrl(config.mcpResource)),
  ];
  if (scope) parameters.push(authParameter("scope", scope));
  return `Bearer ${parameters.join(", ")}`;
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

function challengeError(error?: ServiceError): { error: string; description: string } {
  if (error?.status === 403) return { error: "insufficient_scope", description: "Additional authorization scopes required." };
  return { error: "invalid_token", description: "Authentication required." };
}

function authParameter(name: string, value: string): string {
  return `${name}=${quoteAuthValue(value)}`;
}

function quoteAuthValue(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

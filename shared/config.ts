import { resolve } from "node:path";
import { assertMcpResourceUrl, mcpEndpointPath } from "./mcp-resource.ts";
import { isNonPublicHostname } from "./network-address.ts";

export interface ServiceConfig {
  issuer: string;
  mcpResource: string;
  actionsAudience: string;
  oauthStorePath: string;
  allowedOrigins: string[];
  accessTokenTtlSeconds: number;
  idTokenTtlSeconds: number;
  authorizationCodeTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  rateLimitWindowSeconds: number;
  rateLimitMaxRequests: number;
  mcpSseMaxConnections: number;
  production: boolean;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const production = env.NODE_ENV === "production";
  const issuer = readIssuerUrl(env, production);
  const mcpResource = readHttpUrl(env, "MCP_RESOURCE_URL", `${issuer}${mcpEndpointPath}`, production);
  assertMcpResourceUrl(mcpResource, "MCP_RESOURCE_URL");
  const actionsAudience = readHttpUrl(env, "ACTIONS_AUDIENCE", `${issuer}/actions`, production);
  const oauthStorePath = env.OAUTH_STORE_PATH ?? (production ? "" : resolve(process.cwd(), "var/oauth-store.json"));
  if (production && oauthStorePath === "") throw new Error("OAUTH_STORE_PATH is required");
  return {
    issuer,
    mcpResource,
    actionsAudience,
    oauthStorePath,
    allowedOrigins: readAllowedOrigins(env, production),
    accessTokenTtlSeconds: readNumber(env, "ACCESS_TOKEN_TTL_SECONDS", 900, production),
    idTokenTtlSeconds: readNumber(env, "ID_TOKEN_TTL_SECONDS", 300, production),
    authorizationCodeTtlSeconds: readNumber(env, "AUTHORIZATION_CODE_TTL_SECONDS", 300, production),
    refreshTokenTtlSeconds: readNumber(env, "REFRESH_TOKEN_TTL_SECONDS", 2592000, production),
    rateLimitWindowSeconds: readNumber(env, "RATE_LIMIT_WINDOW_SECONDS", 60, production),
    rateLimitMaxRequests: readNumber(env, "RATE_LIMIT_MAX_REQUESTS", 120, production),
    mcpSseMaxConnections: readNumber(env, "MCP_SSE_MAX_CONNECTIONS", 1024, production),
    production,
  };
}

function parseList(value: string): string[] {
  return value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function readHttpUrl(env: NodeJS.ProcessEnv, key: string, fallback: string, production: boolean): string {
  const value = env[key] ?? (production ? "" : fallback);
  if (!value) throw new Error(`${key} is required`);
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${key} must use http or https`);
  if (production && url.protocol !== "https:") throw new Error(`${key} must use https in production`);
  if (url.username || url.password || url.search || url.hash) throw new Error(`${key} contains unsupported URL parts`);
  if (production && isNonPublicHostname(url.hostname)) throw new Error(`${key} must use a public host in production`);
  return url.href.replace(/\/$/, "");
}

function readIssuerUrl(env: NodeJS.ProcessEnv, production: boolean): string {
  const issuer = readHttpUrl(env, "PUBLIC_ISSUER_URL", "http://localhost:4000", production);
  const url = new URL(issuer);
  if (url.pathname !== "/") throw new Error("PUBLIC_ISSUER_URL must not include a path");
  return issuer;
}

function readAllowedOrigins(env: NodeJS.ProcessEnv, production: boolean): string[] {
  const value = env.ALLOWED_ORIGINS ?? (production ? "" : "https://chatgpt.com https://chat.openai.com http://localhost:4000");
  if (!value) throw new Error("ALLOWED_ORIGINS is required");
  return parseList(value).map((origin) => normalizeOrigin(origin, production));
}

function normalizeOrigin(value: string, production: boolean): string {
  if (value.includes("*")) throw new Error("ALLOWED_ORIGINS cannot contain wildcards");
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("ALLOWED_ORIGINS must use http or https");
  if (production && url.protocol !== "https:") throw new Error("ALLOWED_ORIGINS must use https in production");
  if (url.origin !== url.href.replace(/\/$/, "")) throw new Error("ALLOWED_ORIGINS entries must be origins");
  if (production && isNonPublicHostname(url.hostname)) throw new Error("ALLOWED_ORIGINS entries must use public hosts in production");
  return url.origin;
}

function readNumber(env: NodeJS.ProcessEnv, key: string, fallback: number, production: boolean): number {
  const value = env[key];
  if (value === undefined) {
    if (production) throw new Error(`${key} is required`);
    return fallback;
  }
  const parsed = Number(value);
  if (production && value.trim() === "") throw new Error(`${key} is required`);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${key} must be a positive safe integer`);
  return parsed;
}

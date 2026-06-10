import { resolve } from "node:path";
import { assertMcpResourceUrl, mcpEndpointPath } from "./mcp-resource.ts";
import { isNonPublicHostname } from "./network-address.ts";

export interface ServiceConfig {
  issuer: string;
  mcpResource: string;
  actionsAudience: string;
  widgetDomain: string;
  oauthStoreBackend: OAuthStoreBackend;
  oauthStorePath: string;
  oauthDynamoDb: DynamoDbStoreConfig;
  allowedOrigins: string[];
  accessTokenTtlSeconds: number;
  idTokenTtlSeconds: number;
  authorizationCodeTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  rateLimitWindowSeconds: number;
  rateLimitMaxRequests: number;
  mcpSseMaxConnections: number;
  upstreamOidc: UpstreamOidcConfig;
  production: boolean;
}

export type OAuthStoreBackend = "file" | "dynamodb";

export interface DynamoDbStoreConfig {
  tableName: string;
  region: string;
  endpoint?: string;
}

export type UpstreamOidcTokenAuthMethod = "client_secret_post" | "client_secret_basic";

export interface UpstreamOidcConfig {
  issuer: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  tokenEndpointAuthMethod: UpstreamOidcTokenAuthMethod;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const production = env.NODE_ENV === "production";
  const issuer = readIssuerUrl(env, production);
  const mcpResource = readHttpUrl(env, "MCP_RESOURCE_URL", `${issuer}${mcpEndpointPath}`, production);
  assertMcpResourceUrl(mcpResource, "MCP_RESOURCE_URL");
  const actionsAudience = readHttpUrl(env, "ACTIONS_AUDIENCE", `${issuer}/actions`, production);
  const widgetDomain = readOriginUrl(env, "WIDGET_DOMAIN", issuer, production);
  const oauthStoreBackend = readOAuthStoreBackend(env, production);
  const oauthStorePath = readOAuthStorePath(env, oauthStoreBackend, production);
  const oauthDynamoDb = readDynamoDbStoreConfig(env, oauthStoreBackend, production);
  return {
    issuer,
    mcpResource,
    actionsAudience,
    widgetDomain,
    oauthStoreBackend,
    oauthStorePath,
    oauthDynamoDb,
    allowedOrigins: readAllowedOrigins(env, production),
    accessTokenTtlSeconds: readNumber(env, "ACCESS_TOKEN_TTL_SECONDS", 900, production),
    idTokenTtlSeconds: readNumber(env, "ID_TOKEN_TTL_SECONDS", 300, production),
    authorizationCodeTtlSeconds: readNumber(env, "AUTHORIZATION_CODE_TTL_SECONDS", 300, production),
    refreshTokenTtlSeconds: readNumber(env, "REFRESH_TOKEN_TTL_SECONDS", 2592000, production),
    rateLimitWindowSeconds: readNumber(env, "RATE_LIMIT_WINDOW_SECONDS", 60, production),
    rateLimitMaxRequests: readNumber(env, "RATE_LIMIT_MAX_REQUESTS", 120, production),
    mcpSseMaxConnections: readNumber(env, "MCP_SSE_MAX_CONNECTIONS", 1024, production),
    upstreamOidc: readUpstreamOidcConfig(env, issuer, production),
    production,
  };
}

function readOAuthStoreBackend(env: NodeJS.ProcessEnv, production: boolean): OAuthStoreBackend {
  const value = env.OAUTH_STORE_BACKEND ?? (production ? "" : "file");
  if (value === "file") {
    if (production) throw new Error("OAUTH_STORE_BACKEND must be dynamodb in production");
    return value;
  }
  if (value === "dynamodb") return value;
  if (production && value === "") throw new Error("OAUTH_STORE_BACKEND is required");
  throw new Error("OAUTH_STORE_BACKEND must be file or dynamodb");
}

function readOAuthStorePath(env: NodeJS.ProcessEnv, backend: OAuthStoreBackend, production: boolean): string {
  if (backend !== "file") {
    if (env.OAUTH_STORE_PATH) throw new Error("OAUTH_STORE_PATH requires file store backend");
    return "";
  }
  const value = env.OAUTH_STORE_PATH ?? (backend === "file" ? resolve(process.cwd(), "var/oauth-store.json") : "");
  if (backend === "file" && !value) throw new Error("OAUTH_STORE_PATH is required");
  if (production && value) throw new Error("OAUTH_STORE_PATH is local-development only");
  return value;
}

function readDynamoDbStoreConfig(env: NodeJS.ProcessEnv, backend: OAuthStoreBackend, production: boolean): DynamoDbStoreConfig {
  if (backend !== "dynamodb") return { tableName: "", region: "" };
  const tableName = readDynamoDbName(env, "OAUTH_DYNAMODB_TABLE_NAME", production);
  const region = readAwsRegion(env, "OAUTH_DYNAMODB_REGION", env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? "", production);
  const endpoint = env.OAUTH_DYNAMODB_ENDPOINT?.trim();
  if (production && endpoint) throw new Error("OAUTH_DYNAMODB_ENDPOINT is local-development only");
  return endpoint ? { tableName, region, endpoint: readHttpUrl({ OAUTH_DYNAMODB_ENDPOINT: endpoint }, "OAUTH_DYNAMODB_ENDPOINT", endpoint, false) } : { tableName, region };
}

function readDynamoDbName(env: NodeJS.ProcessEnv, key: string, production: boolean): string {
  const value = readText(env, key, "", production);
  if (!/^[A-Za-z0-9_.-]{3,255}$/.test(value)) throw new Error(`${key} contains invalid characters`);
  return value;
}

function readAwsRegion(env: NodeJS.ProcessEnv, key: string, fallback: string, production: boolean): string {
  const value = readText(env, key, fallback, production);
  if (!/^[a-z]{2}(-[a-z]+)+-[0-9]+$/.test(value)) throw new Error(`${key} contains invalid characters`);
  return value;
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

function readOriginUrl(env: NodeJS.ProcessEnv, key: string, fallback: string, production: boolean): string {
  const value = readHttpUrl(env, key, fallback, production);
  const url = new URL(value);
  if (url.origin !== value) throw new Error(`${key} must be an origin`);
  return url.origin;
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

function readUpstreamOidcConfig(env: NodeJS.ProcessEnv, serviceIssuer: string, production: boolean): UpstreamOidcConfig {
  const localIssuer = "http://127.0.0.1:4100";
  const scopes = parseList(env.UPSTREAM_OIDC_SCOPES ?? "openid profile email");
  if (!scopes.includes("openid")) throw new Error("UPSTREAM_OIDC_SCOPES must include openid");
  return {
    issuer: readHttpUrl(env, "UPSTREAM_OIDC_ISSUER_URL", localIssuer, production),
    authorizationUrl: readHttpUrl(env, "UPSTREAM_OIDC_AUTHORIZATION_URL", `${localIssuer}/oauth2/authorize`, production),
    tokenUrl: readHttpUrl(env, "UPSTREAM_OIDC_TOKEN_URL", `${localIssuer}/oauth2/token`, production),
    userinfoUrl: readHttpUrl(env, "UPSTREAM_OIDC_USERINFO_URL", `${localIssuer}/oauth2/userInfo`, production),
    clientId: readText(env, "UPSTREAM_OIDC_CLIENT_ID", "local-upstream-client", production),
    clientSecret: readText(env, "UPSTREAM_OIDC_CLIENT_SECRET", "local-upstream-secret", production),
    redirectUri: readHttpUrl(env, "UPSTREAM_OIDC_REDIRECT_URI", `${serviceIssuer}/oauth/callback`, production),
    scopes,
    tokenEndpointAuthMethod: readUpstreamTokenAuthMethod(env),
  };
}

function readText(env: NodeJS.ProcessEnv, key: string, fallback: string, production: boolean): string {
  const value = env[key]?.trim() ?? (production ? "" : fallback);
  if (!value) throw new Error(`${key} is required`);
  if (/[\r\n]/.test(value)) throw new Error(`${key} cannot contain line breaks`);
  return value;
}

function readUpstreamTokenAuthMethod(env: NodeJS.ProcessEnv): UpstreamOidcTokenAuthMethod {
  const value = env.UPSTREAM_OIDC_TOKEN_AUTH_METHOD ?? "client_secret_post";
  if (value === "client_secret_post" || value === "client_secret_basic") return value;
  throw new Error("UPSTREAM_OIDC_TOKEN_AUTH_METHOD must be client_secret_post or client_secret_basic");
}

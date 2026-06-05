import { resolve } from "node:path";

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
  production: boolean;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const production = env.NODE_ENV === "production";
  const issuer = env.PUBLIC_ISSUER_URL ?? "http://localhost:4000";
  const mcpResource = env.MCP_RESOURCE_URL ?? issuer;
  const actionsAudience = env.ACTIONS_AUDIENCE ?? `${issuer}/actions`;
  const oauthStorePath = env.OAUTH_STORE_PATH ?? (production ? "" : resolve(process.cwd(), "var/oauth-store.json"));
  if (production && oauthStorePath === "") throw new Error("OAUTH_STORE_PATH is required");
  return {
    issuer,
    mcpResource,
    actionsAudience,
    oauthStorePath,
    allowedOrigins: parseList(env.ALLOWED_ORIGINS ?? "https://chatgpt.com https://chat.openai.com http://localhost:4000"),
    accessTokenTtlSeconds: readNumber(env.ACCESS_TOKEN_TTL_SECONDS, 900),
    idTokenTtlSeconds: readNumber(env.ID_TOKEN_TTL_SECONDS, 300),
    authorizationCodeTtlSeconds: readNumber(env.AUTHORIZATION_CODE_TTL_SECONDS, 300),
    refreshTokenTtlSeconds: readNumber(env.REFRESH_TOKEN_TTL_SECONDS, 2592000),
    production,
  };
}

function parseList(value: string): string[] {
  return value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error("invalid numeric configuration");
  return parsed;
}

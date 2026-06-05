import { constantTimeEqualString, sha256Base64Url } from "../shared/crypto.ts";
import { ServiceError } from "../shared/errors.ts";
import type { ServiceConfig } from "../shared/config.ts";
import { defaultScopes } from "./scopes.ts";

export type TokenEndpointAuthMethod = "client_secret_post" | "client_secret_basic";
export type PkcePolicy = "required" | "optional";

export interface OAuthClient {
  clientId: string;
  clientSecretHash: string;
  displayName: string;
  redirectUris: string[];
  allowedScopes: string[];
  allowedResources: string[];
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  pkcePolicy: PkcePolicy;
}

export function loadClients(config: ServiceConfig, env: NodeJS.ProcessEnv = process.env): OAuthClient[] {
  if (env.OAUTH_CLIENTS_JSON) return parseClientJson(env.OAUTH_CLIENTS_JSON);
  if (config.production) throw new Error("OAUTH_CLIENTS_JSON is required");
  return localClients(config);
}

export function findClient(clients: readonly OAuthClient[], clientId: string): OAuthClient {
  const client = clients.find((candidate) => candidate.clientId === clientId);
  if (!client) throw new ServiceError("invalid_client", "invalid client", 401);
  return client;
}

export function assertClientSecret(client: OAuthClient, secret: string | undefined): void {
  if (!secret) throw new ServiceError("invalid_client", "invalid client", 401);
  const hash = sha256Base64Url(secret);
  if (!constantTimeEqualString(hash, client.clientSecretHash)) {
    throw new ServiceError("invalid_client", "invalid client", 401);
  }
}

export function assertRedirectUri(client: OAuthClient, redirectUri: string): void {
  if (!client.redirectUris.includes(redirectUri)) {
    throw new ServiceError("bad_request", "redirect_uri is not registered", 400);
  }
}

export function assertResource(client: OAuthClient, resource: string): void {
  if (!client.allowedResources.includes(resource)) {
    throw new ServiceError("bad_request", "resource is not allowed", 400);
  }
}

function localClients(config: ServiceConfig): OAuthClient[] {
  const scopes = [...defaultScopes];
  return [
    localClient("local-test", "local-test-secret", "Local Test", ["http://localhost:4000/test/callback"], scopes, [
      config.actionsAudience,
      config.mcpResource,
    ]),
    localClient("gpt-actions", "gpt-actions-secret", "GPT Actions", [
      "https://chat.openai.com/aip/g-local/oauth/callback",
      "https://chatgpt.com/aip/g-local/oauth/callback",
    ], scopes, [config.actionsAudience]),
    localClient("gpt-apps-mcp", "gpt-apps-secret", "GPT Apps MCP", [
      "https://chatgpt.com/connector/oauth/local-callback",
      "https://chatgpt.com/connector_platform_oauth_redirect",
    ], scopes, [config.mcpResource], "required"),
  ];
}

function localClient(
  clientId: string,
  secret: string,
  displayName: string,
  redirectUris: string[],
  allowedScopes: string[],
  allowedResources: string[],
  pkcePolicy: PkcePolicy = "optional",
): OAuthClient {
  return {
    clientId,
    clientSecretHash: sha256Base64Url(secret),
    displayName,
    redirectUris,
    allowedScopes,
    allowedResources,
    tokenEndpointAuthMethod: "client_secret_post",
    pkcePolicy,
  };
}

function parseClientJson(value: string): OAuthClient[] {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("OAUTH_CLIENTS_JSON must be an array");
  return parsed as OAuthClient[];
}

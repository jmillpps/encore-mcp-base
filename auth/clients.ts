import { constantTimeEqualString, sha256Base64Url } from "../shared/crypto.ts";
import { ServiceError } from "../shared/errors.ts";
import type { ServiceConfig } from "../shared/config.ts";
import { defaultScopes } from "./scopes.ts";
import { parseClientJson } from "./client-registry.ts";
import type { OAuthClient, PkcePolicy, TokenEndpointAuthMethod } from "./client-types.ts";

export type { OAuthClient, PkcePolicy } from "./client-types.ts";

export function loadClients(config: ServiceConfig, env: NodeJS.ProcessEnv = process.env): OAuthClient[] {
  if (env.OAUTH_CLIENTS_JSON) return parseClientJson(env.OAUTH_CLIENTS_JSON, config.production);
  if (config.production) throw new Error("OAUTH_CLIENTS_JSON is required");
  return localClients(config);
}

export function findClient(clients: readonly OAuthClient[], clientId: string): OAuthClient {
  const client = clients.find((candidate) => candidate.clientId === clientId);
  if (!client) throw new ServiceError("invalid_client", "invalid client", 401);
  return client;
}

export function assertClientSecret(client: OAuthClient, secret: string | undefined): void {
  if (!secret || !client.clientSecretHash) throw new ServiceError("invalid_client", "invalid client", 401);
  const hash = sha256Base64Url(secret);
  if (!constantTimeEqualString(hash, client.clientSecretHash)) {
    throw new ServiceError("invalid_client", "invalid client", 401);
  }
}

export function assertClientAuthMethod(client: OAuthClient, method: TokenEndpointAuthMethod): void {
  if (client.tokenEndpointAuthMethod !== method) throw new ServiceError("invalid_client", "invalid client", 401);
}

export function assertRedirectUri(client: OAuthClient, redirectUri: string): void {
  if (!client.redirectUris.includes(redirectUri)) {
    throw new ServiceError("bad_request", "redirect_uri is not registered", 400);
  }
}

export function assertResource(client: OAuthClient, resource: string): void {
  if (!client.allowedResources.includes(resource)) {
    throw new ServiceError("invalid_target", "resource is not allowed", 400);
  }
}

function localClients(config: ServiceConfig): OAuthClient[] {
  const scopes = [...defaultScopes];
  return [
    localClient("local-test", "local-test-secret", "Local Test", ["http://localhost:4000/test/callback"], scopes, [
      config.actionsAudience,
      config.mcpResource,
    ], "local-test"),
    localClient("gpt-actions", "gpt-actions-secret", "GPT Actions", [
      "https://chat.openai.com/aip/g-local/oauth/callback",
      "https://chatgpt.com/aip/g-local/oauth/callback",
    ], scopes, [config.actionsAudience], "gpt-actions"),
    localClient("gpt-apps-mcp", "gpt-apps-secret", "GPT Apps MCP", [
      "https://chatgpt.com/connector/oauth/local-callback",
      "https://chatgpt.com/connector_platform_oauth_redirect",
    ], scopes, [config.mcpResource], "gpt-apps-mcp", "required"),
  ];
}

function localClient(
  clientId: string,
  secret: string,
  displayName: string,
  redirectUris: string[],
  allowedScopes: string[],
  allowedResources: string[],
  clientClass: string,
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
    clientClass,
  };
}

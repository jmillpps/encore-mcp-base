import type { ServiceConfig } from "../shared/config.ts";
import { serviceTitle } from "../shared/service-info.ts";
import type { OAuthClient } from "./client-types.ts";
import { mcpProtectedResourceScopes } from "./scopes.ts";

export function openidConfiguration(config: ServiceConfig, clients: readonly OAuthClient[]): Record<string, unknown> {
  return {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/oauth/authorize`,
    token_endpoint: `${config.issuer}/oauth/token`,
    jwks_uri: `${config.issuer}/oauth/jwks`,
    userinfo_endpoint: `${config.issuer}/oauth/userinfo`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: supportedTokenAuthMethods(),
    code_challenge_methods_supported: ["S256"],
    client_id_metadata_document_supported: true,
    scopes_supported: supportedScopes(clients),
    claims_supported: supportedClaims(),
  };
}

export function authorizationServerMetadata(config: ServiceConfig, clients: readonly OAuthClient[]): Record<string, unknown> {
  return {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/oauth/authorize`,
    token_endpoint: `${config.issuer}/oauth/token`,
    jwks_uri: `${config.issuer}/oauth/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: supportedTokenAuthMethods(),
    code_challenge_methods_supported: ["S256"],
    client_id_metadata_document_supported: true,
    scopes_supported: supportedScopes(clients),
  };
}

export function protectedResourceMetadata(config: ServiceConfig): Record<string, unknown> {
  return {
    resource: config.mcpResource,
    resource_name: serviceTitle,
    authorization_servers: [config.issuer],
    scopes_supported: mcpProtectedResourceScopes(),
    bearer_methods_supported: ["header"],
    resource_documentation: `${config.issuer}/docs/mcp`,
  };
}

function supportedClaims(): string[] {
  return ["iss", "sub", "aud", "exp", "iat", "auth_time", "nonce", "name", "given_name", "family_name", "preferred_username", "email", "email_verified"];
}

function supportedTokenAuthMethods(): string[] {
  return ["client_secret_post", "client_secret_basic", "none", "private_key_jwt"];
}

function supportedScopes(clients: readonly OAuthClient[], resource?: string): string[] {
  const scopes = new Set<string>();
  for (const client of clients) {
    if (resource && !client.allowedResources.includes(resource)) continue;
    for (const scope of client.allowedScopes) scopes.add(scope);
  }
  return [...scopes];
}

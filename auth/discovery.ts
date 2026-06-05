import type { ServiceConfig } from "../shared/config.ts";
import { defaultScopes } from "./scopes.ts";

export function openidConfiguration(config: ServiceConfig): Record<string, unknown> {
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
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: defaultScopes,
    claims_supported: ["sub", "name", "given_name", "family_name", "preferred_username", "email", "email_verified"],
  };
}

export function authorizationServerMetadata(config: ServiceConfig): Record<string, unknown> {
  return {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/oauth/authorize`,
    token_endpoint: `${config.issuer}/oauth/token`,
    jwks_uri: `${config.issuer}/oauth/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: defaultScopes,
  };
}

export function protectedResourceMetadata(config: ServiceConfig): Record<string, unknown> {
  return {
    resource: config.mcpResource,
    authorization_servers: [config.issuer],
    scopes_supported: defaultScopes,
    resource_documentation: `${config.issuer}/docs/mcp`,
  };
}

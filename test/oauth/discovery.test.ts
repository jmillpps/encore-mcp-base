import assert from "node:assert/strict";
import test from "node:test";
import { authorizationServerMetadata, openidConfiguration, protectedResourceMetadata } from "../../auth/discovery.ts";
import type { OAuthClient } from "../../auth/client-types.ts";
import { readConfig } from "../../shared/config.ts";
import { discover } from "../support/oauth-client.ts";
import { readJson } from "../support/http.ts";
import { startService } from "../support/service-process.ts";

test("OAuth discovery is processable by oauth4webapi", async (t) => {
  const service = await startService(t);
  const metadata = await discover(service);
  assert.equal(metadata.issuer, service.origin);
  assert.equal(metadata.authorization_endpoint, `${service.origin}/oauth/authorize`);
  assert.equal(metadata.token_endpoint, `${service.origin}/oauth/token`);
  assert.equal(metadata.jwks_uri, `${service.origin}/oauth/jwks`);
  assert.deepEqual(metadata.grant_types_supported, ["authorization_code", "refresh_token"]);
  assert.deepEqual(metadata.token_endpoint_auth_methods_supported, ["client_secret_post", "client_secret_basic", "none", "private_key_jwt"]);
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(metadata.scopes_supported, ["openid", "profile", "email"]);
  assert.ok(metadata.claims_supported?.includes("nonce"));
  assert.ok(metadata.claims_supported?.includes("auth_time"));
  const authorizationServer = await readJson(await fetch(`${service.origin}/.well-known/oauth-authorization-server`));
  assert.equal(authorizationServer.client_id_metadata_document_supported, true);
  assert.deepEqual(authorizationServer.token_endpoint_auth_methods_supported, ["client_secret_post", "client_secret_basic", "none", "private_key_jwt"]);
  const protectedResource = await readJson(await fetch(`${service.origin}/.well-known/oauth-protected-resource`));
  assert.equal(protectedResource.resource, service.mcpResource);
  assert.equal(protectedResource.resource_name, "GPT MCP Service");
  assert.deepEqual(protectedResource.bearer_methods_supported, ["header"]);
  assert.deepEqual(protectedResource.scopes_supported, ["openid", "profile", "email"]);
  const mcpProtectedResource = await readJson(await fetch(`${service.origin}/.well-known/oauth-protected-resource/mcp`));
  assert.deepEqual(mcpProtectedResource, protectedResource);
});

test("authorization server metadata advertises client scopes while protected resource metadata stays tied to MCP tool scopes", () => {
  const config = readConfig({
    PUBLIC_ISSUER_URL: "https://issuer.example.test",
    MCP_RESOURCE_URL: "https://mcp.example.test/mcp",
    ACTIONS_AUDIENCE: "https://api.example.test/actions",
  });
  const clients: OAuthClient[] = [
    client("actions-client", config.actionsAudience, ["openid", "profile", "email", "actions:write"]),
    client("mcp-client", config.mcpResource, ["openid", "profile", "email", "mcp:read"]),
  ];
  assert.deepEqual(openidConfiguration(config, clients).scopes_supported, ["openid", "profile", "email", "actions:write", "mcp:read"]);
  assert.deepEqual(authorizationServerMetadata(config, clients).scopes_supported, ["openid", "profile", "email", "actions:write", "mcp:read"]);
  assert.deepEqual(protectedResourceMetadata(config).scopes_supported, ["openid", "profile", "email"]);
  assert.deepEqual(protectedResourceMetadata(config).bearer_methods_supported, ["header"]);
  assert.equal(protectedResourceMetadata(config).resource_name, "GPT MCP Service");
});

function client(clientId: string, resource: string, scopes: string[]): OAuthClient {
  return {
    clientId,
    clientSecretHash: "a".repeat(43),
    displayName: clientId,
    redirectUris: ["https://chatgpt.com/callback"],
    allowedScopes: scopes,
    allowedResources: [resource],
    tokenEndpointAuthMethod: "client_secret_post",
    pkcePolicy: "required",
    clientClass: clientId,
  };
}

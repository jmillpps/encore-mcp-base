import assert from "node:assert/strict";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { resolveClientIdMetadataDocument } from "../../auth/client-id-metadata-document.ts";
import { resolveMetadataNetworkAddress } from "../../auth/client-metadata-network.ts";
import { parseMetadataClient } from "../../auth/client-metadata-parser.ts";
import { ServiceError } from "../../shared/errors.ts";
import { readConfig } from "../../shared/config.ts";
import { callTool, initializeMcp, bearer } from "../support/mcp.ts";
import { readJson } from "../support/http.ts";
import { startService, type TestService } from "../support/service-process.ts";
import { authorizeMetadataDocumentClient, fetchAuthorizationUrl, startMetadataServer } from "../support/client-metadata.ts";

test("Client ID Metadata Document clients complete OAuth and call protected MCP tools", async (t) => {
  const service = await startService(t);
  const metadata = await startMetadataServer(t, service.mcpResource);
  const sessionId = await initializeMcp(service);
  const { tokens, idClaims } = await completeMetadataDocumentFlow(service, metadata.clientId, metadata.redirectUri);
  assert.equal(idClaims.aud, metadata.clientId);
  const profile = await callTool(service, sessionId, "identity.profile", bearer(tokens.access_token));
  assert.equal((profile.structuredContent as Record<string, unknown>).email, "jmiller@inifnitedevlab.com");
  const session = await callTool(service, sessionId, "auth.session", bearer(tokens.access_token));
  assert.equal((session.structuredContent as Record<string, unknown>).clientId, metadata.clientId);
});

test("metadata document clients reject confidential token authentication and continue with public auth", async (t) => {
  const service = await startService(t);
  const metadata = await startMetadataServer(t, service.mcpResource);
  const authorization = await authorizeMetadataDocumentClient(service, metadata.clientId, metadata.redirectUri);
  const rejected = await oauth.authorizationCodeGrantRequest(
    authorization.as,
    { client_id: metadata.clientId },
    oauth.ClientSecretPost("attacker-secret"),
    authorization.callbackParameters,
    metadata.redirectUri,
    authorization.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.mcpResource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  assert.equal(rejected.status, 401);
  assert.equal((await readJson(rejected)).error, "invalid_client");
  const accepted = await oauth.authorizationCodeGrantRequest(
    authorization.as,
    { client_id: metadata.clientId },
    oauth.None(),
    authorization.callbackParameters,
    metadata.redirectUri,
    authorization.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.mcpResource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  const tokens = await oauth.processAuthorizationCodeResponse(authorization.as, { client_id: metadata.clientId }, accepted, {
    requireIdToken: true,
    expectedNonce: oauth.expectNoNonce,
  });
  assert.ok(tokens.access_token);
});

test("metadata document client_id mismatch is rejected before issuing a code", async (t) => {
  const service = await startService(t);
  const metadata = await startMetadataServer(t, service.mcpResource, { clientIdOverride: "http://127.0.0.1/wrong-client.json" });
  const response = await fetchAuthorizationUrl(service, metadata.clientId, metadata.redirectUri);
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "invalid_client");
});

test("metadata document unsupported token auth method is rejected before issuing a code", async (t) => {
  const service = await startService(t);
  const metadata = await startMetadataServer(t, service.mcpResource, { tokenEndpointAuthMethod: "client_secret_post" });
  const response = await fetchAuthorizationUrl(service, metadata.clientId, metadata.redirectUri);
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "invalid_client");
});

test("metadata document clients allow production loopback HTTP redirect URIs", () => {
  const config = productionConfig();
  const clientId = "https://client.example.test/client.json";
  const client = parseMetadataClient(config, clientId, {
    client_id: clientId,
    client_name: "Desktop MCP Client",
    redirect_uris: ["http://127.0.0.1:3000/callback", "http://localhost:3000/callback"],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
  assert.deepEqual(client.redirectUris, ["http://127.0.0.1:3000/callback", "http://localhost:3000/callback"]);
});

test("metadata document clients reject production public HTTP redirect URIs", () => {
  const config = productionConfig();
  const clientId = "https://client.example.test/client.json";
  assert.throws(
    () => parseMetadataClient(config, clientId, {
      client_id: clientId,
      client_name: "Public HTTP Client",
      redirect_uris: ["http://public.example.test/callback"],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    (error) => error instanceof ServiceError && error.code === "invalid_client",
  );
});

test("production metadata document resolution rejects unsafe URL targets", async () => {
  const config = productionConfig();
  for (const clientId of [
    "https://localhost/client.json",
    "https://127.0.0.1/client.json",
    "https://10.0.0.1/client.json",
    "http://client.example.test/client.json",
    "https://client.example.test/",
    "https://client.example.test/client.json#fragment",
    "https://user:pass@client.example.test/client.json",
  ]) {
    await assert.rejects(
      () => resolveClientIdMetadataDocument(config, clientId),
      (error) => error instanceof ServiceError && error.code === "invalid_client",
    );
  }
});

test("production metadata document resolution rejects special-use IP targets", async () => {
  for (const target of [
    "https://100.64.0.1/client.json",
    "https://192.0.2.1/client.json",
    "https://198.18.0.1/client.json",
    "https://198.51.100.1/client.json",
    "https://203.0.113.1/client.json",
    "https://[2001:db8::1]/client.json",
    "https://[::ffff:198.18.0.1]/client.json",
    "https://[ff02::1]/client.json",
  ]) {
    await assert.rejects(
      () => resolveMetadataNetworkAddress(new URL(target), true),
      (error) => error instanceof ServiceError && error.code === "invalid_client",
    );
  }
  assert.deepEqual(await resolveMetadataNetworkAddress(new URL("https://8.8.8.8/client.json"), true), { address: "8.8.8.8", family: 4 });
});

async function completeMetadataDocumentFlow(
  service: TestService,
  clientId: string,
  redirectUri: string,
): Promise<{ tokens: oauth.TokenEndpointResponse; idClaims: oauth.IDToken }> {
  const authorization = await authorizeMetadataDocumentClient(service, clientId, redirectUri);
  const tokenResponse = await oauth.authorizationCodeGrantRequest(
    authorization.as,
    { client_id: clientId },
    oauth.None(),
    authorization.callbackParameters,
    redirectUri,
    authorization.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.mcpResource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  const tokens = await oauth.processAuthorizationCodeResponse(authorization.as, { client_id: clientId }, tokenResponse, {
    requireIdToken: true,
    expectedNonce: oauth.expectNoNonce,
  });
  await oauth.validateApplicationLevelSignature(authorization.as, tokenResponse, { [oauth.allowInsecureRequests]: true });
  const idClaims = oauth.getValidatedIdTokenClaims(tokens);
  assert.ok(idClaims);
  return { tokens, idClaims };
}

function productionConfig() {
  return readConfig({
    NODE_ENV: "production",
    PUBLIC_ISSUER_URL: "https://issuer.example.test",
    MCP_RESOURCE_URL: "https://mcp.example.test/mcp",
    ACTIONS_AUDIENCE: "https://actions.example.test/actions",
    OAUTH_STORE_PATH: "/tmp/mcp-oauth-store.json",
    ALLOWED_ORIGINS: "https://chatgpt.com",
    ACCESS_TOKEN_TTL_SECONDS: "900",
    ID_TOKEN_TTL_SECONDS: "300",
    AUTHORIZATION_CODE_TTL_SECONDS: "300",
    REFRESH_TOKEN_TTL_SECONDS: "2592000",
    RATE_LIMIT_WINDOW_SECONDS: "60",
    RATE_LIMIT_MAX_REQUESTS: "120",
    MCP_SSE_MAX_CONNECTIONS: "1024",
  });
}

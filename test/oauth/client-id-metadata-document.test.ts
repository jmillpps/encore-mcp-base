import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { resolveClientIdMetadataDocument } from "../../auth/client-id-metadata-document.ts";
import { ServiceError } from "../../shared/errors.ts";
import { readConfig } from "../../shared/config.ts";
import { callTool, initializeMcp, bearer } from "../support/mcp.ts";
import { discover } from "../support/oauth-client.ts";
import { readJson, requireString } from "../support/http.ts";
import { startService, type TestService } from "../support/service-process.ts";

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

async function authorizeMetadataDocumentClient(
  service: TestService,
  clientId: string,
  redirectUri: string,
): Promise<{ as: oauth.AuthorizationServer; callbackParameters: URLSearchParams; codeVerifier: string }> {
  const as = await discover(service);
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.generateRandomState();
  const response = await fetchAuthorizationUrl(service, clientId, redirectUri, state, codeChallenge);
  assert.equal(response.status, 302);
  const callback = new URL(requireString(response.headers.get("location"), "location"));
  return {
    as,
    callbackParameters: oauth.validateAuthResponse(as, { client_id: clientId }, callback, state),
    codeVerifier,
  };
}

async function fetchAuthorizationUrl(
  service: TestService,
  clientId: string,
  redirectUri: string,
  state = oauth.generateRandomState(),
  codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
): Promise<Response> {
  const as = await discover(service);
  const url = new URL(requireString(as.authorization_endpoint, "authorization_endpoint"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("resource", service.mcpResource);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return fetch(url, { redirect: "manual" });
}

async function startMetadataServer(
  t: TestContextLike,
  resource: string,
  options: { clientIdOverride?: string; tokenEndpointAuthMethod?: string } = {},
): Promise<{ clientId: string; redirectUri: string }> {
  let clientId = "";
  let redirectUri = "";
  const server = createServer((req, res) => {
    if (req.url !== "/client.json") {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({
      client_id: options.clientIdOverride ?? clientId,
      client_name: "Metadata Test Client",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: options.tokenEndpointAuthMethod ?? "none",
      resource,
    }));
  });
  await listen(server);
  const address = server.address();
  assertAddressInfo(address);
  clientId = `http://127.0.0.1:${address.port}/client.json`;
  redirectUri = `http://127.0.0.1:${address.port}/callback`;
  t.after(async () => close(server));
  return { clientId, redirectUri };
}

async function listen(server: Server): Promise<void> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
}

async function close(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

interface TestContextLike {
  after(fn: () => Promise<void>): void;
}

function assertAddressInfo(value: string | AddressInfo | null): asserts value is AddressInfo {
  assert.equal(typeof value, "object");
  assert.ok(value);
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
  });
}

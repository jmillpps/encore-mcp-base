import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
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
import { testUserProfile } from "../support/user-profile.ts";
import { authorizeMetadataDocumentClient, fetchAuthorizationUrl, startInvalidUtf8MetadataServer, startMetadataServer } from "../support/client-metadata.ts";

test("Client ID Metadata Document clients complete OAuth and call protected MCP tools", async (t) => {
  const service = await startService(t);
  const metadata = await startMetadataServer(t, service.mcpResource);
  const sessionId = await initializeMcp(service);
  const { tokens, idClaims } = await completeMetadataDocumentFlow(service, metadata.clientId, metadata.redirectUri);
  assert.equal(idClaims.aud, metadata.clientId);
  const profile = await callTool(service, sessionId, "identity.profile", bearer(tokens.access_token));
  assert.equal((profile.structuredContent as Record<string, unknown>).email, testUserProfile.email);
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

test("metadata document client names reject control characters", () => {
  const config = readConfig({});
  const clientId = "http://127.0.0.1:4000/client.json";
  assert.throws(
    () => parseMetadataClient(config, clientId, {
      client_id: clientId,
      client_name: "Metadata\nClient",
      redirect_uris: ["http://127.0.0.1:4000/callback"],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    (error) => error instanceof ServiceError && error.code === "invalid_client",
  );
});

test("metadata document clients reject invalid UTF-8 documents before issuing a code", async (t) => {
  const service = await startService(t);
  const metadata = await startInvalidUtf8MetadataServer(t);
  const response = await fetchAuthorizationUrl(service, metadata.clientId, metadata.redirectUri);
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "invalid_client");
});

test("metadata document cache evicts older remote clients after bounded capacity", async (t) => {
  const config = readConfig({});
  const metadata = await startCountingMetadataDocumentServer(t, config.mcpResource);
  const firstClientId = metadata.clientId(0);
  await resolveClientIdMetadataDocument(config, firstClientId);
  for (let index = 1; index <= 70; index += 1) {
    await resolveClientIdMetadataDocument(config, metadata.clientId(index));
  }
  assert.equal(metadata.count(firstClientId), 1);
  await resolveClientIdMetadataDocument(config, firstClientId);
  assert.equal(metadata.count(firstClientId), 2);
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

async function startCountingMetadataDocumentServer(
  t: TestContextLike,
  resource: string,
): Promise<{ clientId(index: number): string; count(clientId: string): number }> {
  const hits = new Map<string, number>();
  let origin = "";
  const server = createServer((req, res) => {
    const path = req.url ?? "/";
    if (!/^\/client-\d+\.json$/.test(path)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const clientId = `${origin}${path}`;
    hits.set(clientId, (hits.get(clientId) ?? 0) + 1);
    res.writeHead(200, { "content-type": "application/json", "cache-control": "max-age=3600" });
    res.end(JSON.stringify({
      client_id: clientId,
      client_name: "Counting Metadata Client",
      redirect_uris: [`${origin}/callback`],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      resource,
    }));
  });
  await listen(server);
  const address = server.address();
  assertAddressInfo(address);
  origin = `http://127.0.0.1:${address.port}`;
  t.after(async () => close(server));
  return {
    clientId(index: number) {
      return `${origin}/client-${index}.json`;
    },
    count(clientId: string) {
      return hits.get(clientId) ?? 0;
    },
  };
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

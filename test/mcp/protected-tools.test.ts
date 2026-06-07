import assert from "node:assert/strict";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, discover } from "../support/oauth-client.ts";
import { callTool, initializeMcp, postMcp, bearer } from "../support/mcp.ts";
import { readJson, requireString } from "../support/http.ts";
import { startService, type TestService } from "../support/service-process.ts";

const gptAppsMcpClient: oauth.Client = { client_id: "gpt-apps-mcp" };
const gptAppsMcpSecret = "gpt-apps-secret";
const gptAppsMcpRedirectUri = "https://chatgpt.com/connector/oauth/local-callback";

test("MCP tools expose metadata and protected tools return auth challenges", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const listed = await postMcp(service, { jsonrpc: "2.0", id: "list", method: "tools/list" }, { sessionId });
  assert.equal(listed.status, 200);
  const listBody = await readJson(listed);
  const tools = ((listBody.result as Record<string, unknown>).tools as Record<string, unknown>[]);
  assert.ok(tools.some((tool) => tool.name === "identity.profile" && Array.isArray(tool.securitySchemes)));
  for (const tool of tools) assert.match(requireString(tool.name, "tool name"), /^[A-Za-z0-9_.-]{1,128}$/);
  const challengeResponse = await postMcp(service, { jsonrpc: "2.0", id: "identity.profile", method: "tools/call", params: { name: "identity.profile", arguments: {} } }, { sessionId });
  assert.equal(challengeResponse.status, 200);
  assert.match(challengeResponse.headers.get("www-authenticate") ?? "", /resource_metadata=/);
  assert.match(challengeResponse.headers.get("www-authenticate") ?? "", /scope="openid profile email"/);
  const challenge = (await readJson(challengeResponse)).result as Record<string, unknown>;
  assert.equal(challenge.isError, true);
  const meta = challenge._meta as Record<string, unknown>;
  assert.ok(Array.isArray(meta["mcp/www_authenticate"]));
});

test("MCP tools return structured content that matches advertised output schemas", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const health = await callTool(service, sessionId, "health.check");
  const healthContent = health.structuredContent as Record<string, unknown>;
  assert.equal(healthContent.status, "ok");
  assert.equal(typeof healthContent.timestamp, "string");
  const serviceInfo = healthContent.service as Record<string, unknown>;
  assert.equal(serviceInfo.name, "gpt-mcp-service");
  assert.equal(serviceInfo.version, "0.1.0");
  const validFlow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const session = await callTool(service, sessionId, "auth.session", bearer(validFlow.tokens.access_token));
  const sessionContent = session.structuredContent as Record<string, unknown>;
  assert.equal(sessionContent.subject, "user_justin_miller");
  assert.equal(sessionContent.clientId, "local-test");
  assert.ok(Array.isArray(sessionContent.scopes));
});

test("MCP protected tools enforce audience and scopes", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const validFlow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const profile = await callTool(service, sessionId, "identity.profile", bearer(validFlow.tokens.access_token));
  assert.equal((profile.structuredContent as Record<string, unknown>).email, "jmiller@inifnitedevlab.com");
  const actionsFlow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const wrongAudience = await callTool(service, sessionId, "identity.profile", bearer(actionsFlow.tokens.access_token));
  assert.equal(wrongAudience.isError, true);
  const narrowFlow = await completeAuthorizationCodeFlow(service, service.mcpResource, "openid");
  const missingScopes = await callTool(service, sessionId, "identity.profile", bearer(narrowFlow.tokens.access_token));
  assert.equal(missingScopes.isError, true);
});

test("MCP protected tools accept the GPT Apps client required-PKCE token flow", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const { tokens, idClaims } = await completeGptAppsMcpFlow(service);
  assert.equal(idClaims.aud, gptAppsMcpClient.client_id);
  const profile = await callTool(service, sessionId, "identity.profile", bearer(tokens.access_token));
  assert.equal((profile.structuredContent as Record<string, unknown>).email, "jmiller@inifnitedevlab.com");
  const session = await callTool(service, sessionId, "auth.session", bearer(tokens.access_token));
  assert.equal((session.structuredContent as Record<string, unknown>).clientId, gptAppsMcpClient.client_id);
});

test("MCP tools return execution errors for input schema validation failures", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const response = await postMcp(
    service,
    { jsonrpc: "2.0", id: "bad-args", method: "tools/call", params: { name: "health.check", arguments: { unexpected: true } } },
    { sessionId },
  );
  assert.equal(response.status, 200);
  const body = await readJson(response);
  const result = body.result as Record<string, unknown>;
  assert.equal(result.isError, true);
  assert.match(JSON.stringify(result.content), /unsupported argument/);
});

test("MCP tools return protocol errors for malformed tool requests and unknown tools", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const malformed = await postMcp(
    service,
    { jsonrpc: "2.0", id: "malformed-tool", method: "tools/call", params: { name: "health.check", arguments: [] } },
    { sessionId },
  );
  assert.equal(malformed.status, 200);
  assert.equal(((await readJson(malformed)).error as Record<string, unknown>).code, -32602);
  const unknown = await postMcp(service, { jsonrpc: "2.0", id: "unknown-tool", method: "tools/call", params: { name: "missing.tool" } }, { sessionId });
  assert.equal(unknown.status, 200);
  const error = (await readJson(unknown)).error as Record<string, unknown>;
  assert.equal(error.code, -32602);
  assert.match(requireString(error.message, "error message"), /Unknown tool/);
});

async function completeGptAppsMcpFlow(service: TestService): Promise<{ tokens: oauth.TokenEndpointResponse; idClaims: oauth.IDToken }> {
  const as = await discover(service);
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.generateRandomState();
  const url = new URL(requireString(as.authorization_endpoint, "authorization_endpoint"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", gptAppsMcpClient.client_id);
  url.searchParams.set("redirect_uri", gptAppsMcpRedirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("resource", service.mcpResource);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  const authorization = await fetch(url, { redirect: "manual" });
  assert.equal(authorization.status, 302);
  const callback = new URL(requireString(authorization.headers.get("location"), "location"));
  const callbackParameters = oauth.validateAuthResponse(as, gptAppsMcpClient, callback, state);
  const tokenResponse = await oauth.authorizationCodeGrantRequest(
    as,
    gptAppsMcpClient,
    oauth.ClientSecretPost(gptAppsMcpSecret),
    callbackParameters,
    gptAppsMcpRedirectUri,
    codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.mcpResource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  const tokens = await oauth.processAuthorizationCodeResponse(as, gptAppsMcpClient, tokenResponse, {
    requireIdToken: true,
    expectedNonce: oauth.expectNoNonce,
  });
  await oauth.validateApplicationLevelSignature(as, tokenResponse, { [oauth.allowInsecureRequests]: true });
  const idClaims = oauth.getValidatedIdTokenClaims(tokens);
  assert.ok(idClaims);
  return { tokens, idClaims };
}

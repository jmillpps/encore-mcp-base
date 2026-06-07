import assert from "node:assert/strict";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, discover } from "../support/oauth-client.ts";
import { callTool, initializeMcp, postMcp, bearer } from "../support/mcp.ts";
import { readJson, requireRecord, requireString } from "../support/http.ts";
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
  assert.ok(tools.some((tool) => tool.name === "identity.profile"));
  for (const tool of tools) {
    assert.match(requireString(tool.name, "tool name"), /^[A-Za-z0-9_.-]{1,128}$/);
    assert.equal(requireRecord(tool.annotations, "tool annotations").readOnlyHint, true);
    assert.deepEqual(tool.execution, { taskSupport: "forbidden" });
  }
  assert.deepEqual(toolByName(tools, "health.check").securitySchemes, [{ type: "noauth" }]);
  assert.deepEqual(toolByName(tools, "identity.profile").securitySchemes, [{ type: "oauth2", scopes: ["openid", "profile", "email"] }]);
  assert.deepEqual(toolByName(tools, "auth.session").securitySchemes, [{ type: "oauth2", scopes: ["openid"] }]);
  const challengeResponse = await postMcp(service, { jsonrpc: "2.0", id: "identity.profile", method: "tools/call", params: { name: "identity.profile", arguments: {} } }, { sessionId });
  assert.equal(challengeResponse.status, 200);
  const challengeHeader = challengeResponse.headers.get("www-authenticate") ?? "";
  assert.match(challengeHeader, /error="invalid_token"/);
  assert.match(challengeHeader, /error_description="Authentication required\."/);
  assert.match(challengeHeader, resourceMetadataPattern(service));
  assert.match(challengeHeader, /scope="openid profile email"/);
  assert.doesNotMatch(challengeHeader, /insufficient_scope/);
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
  assert.deepEqual(readToolTextJson(health), health.structuredContent);
  const validFlow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const session = await callTool(service, sessionId, "auth.session", bearer(validFlow.tokens.access_token));
  const sessionContent = session.structuredContent as Record<string, unknown>;
  assert.equal(sessionContent.subject, "user_justin_miller");
  assert.equal(sessionContent.clientId, "local-test");
  assert.ok(Array.isArray(sessionContent.scopes));
  assert.deepEqual(readToolTextJson(session), session.structuredContent);
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
  const missingScopeResponse = await postMcp(
    service,
    { jsonrpc: "2.0", id: "identity.profile", method: "tools/call", params: { name: "identity.profile", arguments: {} } },
    { sessionId, authorization: bearer(narrowFlow.tokens.access_token) },
  );
  assert.equal(missingScopeResponse.status, 200);
  const scopeChallenge = missingScopeResponse.headers.get("www-authenticate") ?? "";
  assert.match(scopeChallenge, /error="insufficient_scope"/);
  assert.match(scopeChallenge, /error_description="Additional authorization scopes required\."/);
  assert.match(scopeChallenge, resourceMetadataPattern(service));
  assert.match(scopeChallenge, /scope="openid profile email"/);
  const missingScopes = ((await readJson(missingScopeResponse)).result as Record<string, unknown>);
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
  const malformedMeta = await postMcp(
    service,
    { jsonrpc: "2.0", id: "malformed-meta", method: "tools/call", params: { name: "health.check", _meta: [] } },
    { sessionId },
  );
  assert.equal(malformedMeta.status, 200);
  assert.equal(((await readJson(malformedMeta)).error as Record<string, unknown>).code, -32602);
  const unknown = await postMcp(service, { jsonrpc: "2.0", id: "unknown-tool", method: "tools/call", params: { name: "missing.tool" } }, { sessionId });
  assert.equal(unknown.status, 200);
  const error = (await readJson(unknown)).error as Record<string, unknown>;
  assert.equal(error.code, -32602);
  assert.match(requireString(error.message, "error message"), /Unknown tool/);
  const taskAugmented = await postMcp(
    service,
    { jsonrpc: "2.0", id: "task-tool", method: "tools/call", params: { name: "health.check", task: { id: "task-1" } } },
    { sessionId },
  );
  assert.equal(taskAugmented.status, 200);
  const taskError = (await readJson(taskAugmented)).error as Record<string, unknown>;
  assert.equal(taskError.code, -32602);
  assert.match(requireString(taskError.message, "task error message"), /task/);
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

function readToolTextJson(result: Record<string, unknown>): unknown {
  const content = result.content;
  assert.ok(Array.isArray(content));
  const first = requireRecord(content[0], "tool content");
  return JSON.parse(requireString(first.text, "tool content text"));
}

function resourceMetadataPattern(service: TestService): RegExp {
  return new RegExp(`resource_metadata="${service.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/\\.well-known\\/oauth-protected-resource\\/mcp"`);
}

function toolByName(tools: Record<string, unknown>[], name: string): Record<string, unknown> {
  const tool = tools.find((candidate) => candidate.name === name);
  assert.ok(tool);
  return tool;
}

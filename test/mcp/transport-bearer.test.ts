import assert from "node:assert/strict";
import test from "node:test";
import { bearer, initializeMcp, mcpAuthorization, postMcp } from "../support/mcp.ts";
import { completeAuthorizationCodeFlow } from "../support/oauth-client.ts";
import { expectOAuthError, readJson } from "../support/http.ts";
import { startService } from "../support/service-process.ts";
import { SseReader } from "../support/sse.ts";

test("MCP receive transports require bearer tokens", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  await expectOAuthError(await assertScopedChallenge(getMcp(service, sessionId)), 401, "unauthorized");
  await expectOAuthError(await assertScopedChallenge(getLegacySse(service.origin)), 401, "unauthorized");
});

test("MCP receive transports reject presented bearer tokens for other audiences", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const actionsFlow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const wrongAudience = bearer(actionsFlow.tokens.access_token);
  await expectOAuthError(await assertScopedChallenge(getMcp(service, sessionId, wrongAudience)), 401, "unauthorized");
  await expectOAuthError(await assertScopedChallenge(deleteMcp(service, sessionId, wrongAudience)), 401, "unauthorized");
  await expectOAuthError(await assertScopedChallenge(getLegacySse(service.origin, wrongAudience)), 401, "unauthorized");
  const recovery = await postMcp(service, { jsonrpc: "2.0", id: "recovery", method: "ping" }, { sessionId });
  assert.equal(recovery.status, 200);
});

test("MCP message transports reject bearer tokens for other audiences before tool handling", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const actionsFlow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const wrongAudience = bearer(actionsFlow.tokens.access_token);
  const post = await postMcp(service, healthCall(), { sessionId, authorization: wrongAudience });
  await expectOAuthError(await assertScopedChallenge(Promise.resolve(post)), 401, "unauthorized");
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(`${service.origin}/sse`, { signal: controller.signal, headers: { accept: "text/event-stream", authorization: await mcpAuthorization(service), origin: "https://chatgpt.com" } });
  assert.equal(stream.status, 200);
  assert.ok(stream.body);
  const endpoint = (await new SseReader(stream.body.getReader()).readEvent()).data;
  const legacyPost = await postLegacyMessage(service.origin, endpoint, wrongAudience);
  await expectOAuthError(await assertScopedChallenge(Promise.resolve(legacyPost)), 401, "unauthorized");
  const recovery = await postMcp(service, healthCall(), { sessionId });
  assert.equal(recovery.status, 200);
  assert.equal((((await readJson(recovery)).result as Record<string, unknown>).structuredContent as Record<string, unknown>).status, "ok");
});

test("MCP transports accept presented bearer tokens for the MCP resource", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const mcpFlow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const response = await postMcp(service, healthCall(), { sessionId, authorization: bearer(mcpFlow.tokens.access_token) });
  assert.equal(response.status, 200);
  const result = (await readJson(response)).result as Record<string, unknown>;
  assert.equal((result.structuredContent as Record<string, unknown>).status, "ok");
});

function healthCall(): Record<string, unknown> {
  return { jsonrpc: "2.0", id: "health", method: "tools/call", params: { name: "health.check", arguments: {} } };
}

function getMcp(service: { origin: string }, sessionId: string, authorization?: string): Promise<Response> {
  const headers = new Headers({ accept: "text/event-stream", origin: "https://chatgpt.com", "mcp-session-id": sessionId, "mcp-protocol-version": "2025-11-25" });
  if (authorization) headers.set("authorization", authorization);
  return fetch(`${service.origin}/mcp`, {
    headers,
  });
}

function deleteMcp(service: { origin: string }, sessionId: string, authorization: string): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "DELETE",
    headers: { authorization, origin: "https://chatgpt.com", "mcp-session-id": sessionId, "mcp-protocol-version": "2025-11-25" },
  });
}

function getLegacySse(origin: string, authorization?: string): Promise<Response> {
  const headers = new Headers({ accept: "text/event-stream", origin: "https://chatgpt.com" });
  if (authorization) headers.set("authorization", authorization);
  return fetch(`${origin}/sse`, { headers });
}

function postLegacyMessage(origin: string, endpoint: string, authorization: string): Promise<Response> {
  return fetch(`${origin}${endpoint}`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json", origin: "https://chatgpt.com" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "health", method: "tools/call", params: { name: "health.check", arguments: {} } }),
  });
}

async function assertScopedChallenge(responsePromise: Promise<Response>): Promise<Response> {
  const response = await responsePromise;
  const challenge = response.headers.get("www-authenticate") ?? "";
  assert.match(challenge, /resource_metadata=/);
  assert.match(challenge, /scope="openid profile email"/);
  return response;
}

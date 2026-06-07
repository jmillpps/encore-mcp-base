import assert from "node:assert/strict";
import test from "node:test";
import { bearer, initializeMcp, postMcp } from "../support/mcp.ts";
import { completeAuthorizationCodeFlow } from "../support/oauth-client.ts";
import { expectOAuthError, readJson } from "../support/http.ts";
import { startService } from "../support/service-process.ts";
import { SseReader } from "../support/sse.ts";

test("MCP receive transports reject presented bearer tokens for other audiences", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const actionsFlow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const wrongAudience = bearer(actionsFlow.tokens.access_token);
  await expectOAuthError(await getMcp(service, sessionId, wrongAudience), 401, "unauthorized");
  await expectOAuthError(await deleteMcp(service, sessionId, wrongAudience), 401, "unauthorized");
  await expectOAuthError(await getLegacySse(service.origin, wrongAudience), 401, "unauthorized");
  const recovery = await postMcp(service, { jsonrpc: "2.0", id: "recovery", method: "ping" }, { sessionId });
  assert.equal(recovery.status, 200);
});

test("MCP message transports defer presented bearer validation to tools", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const actionsFlow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const wrongAudience = bearer(actionsFlow.tokens.access_token);
  const post = await postMcp(service, healthCall(), { sessionId, authorization: wrongAudience });
  assert.equal(post.status, 200);
  assert.equal((((await readJson(post)).result as Record<string, unknown>).structuredContent as Record<string, unknown>).status, "ok");
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(`${service.origin}/sse`, { signal: controller.signal, headers: { accept: "text/event-stream", origin: "https://chatgpt.com" } });
  assert.equal(stream.status, 200);
  assert.ok(stream.body);
  const endpoint = (await new SseReader(stream.body.getReader()).readEvent()).data;
  const legacyPost = await postLegacyMessage(service.origin, endpoint, wrongAudience);
  assert.equal(legacyPost.status, 202);
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

function getMcp(service: { origin: string }, sessionId: string, authorization: string): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    headers: { accept: "text/event-stream", authorization, origin: "https://chatgpt.com", "mcp-session-id": sessionId, "mcp-protocol-version": "2025-11-25" },
  });
}

function deleteMcp(service: { origin: string }, sessionId: string, authorization: string): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "DELETE",
    headers: { authorization, origin: "https://chatgpt.com", "mcp-session-id": sessionId, "mcp-protocol-version": "2025-11-25" },
  });
}

function getLegacySse(origin: string, authorization: string): Promise<Response> {
  return fetch(`${origin}/sse`, { headers: { accept: "text/event-stream", authorization, origin: "https://chatgpt.com" } });
}

function postLegacyMessage(origin: string, endpoint: string, authorization: string): Promise<Response> {
  return fetch(`${origin}${endpoint}`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json", origin: "https://chatgpt.com" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "health", method: "tools/call", params: { name: "health.check", arguments: {} } }),
  });
}

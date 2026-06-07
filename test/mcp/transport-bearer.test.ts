import assert from "node:assert/strict";
import test from "node:test";
import { bearer, initializeMcp, postMcp } from "../support/mcp.ts";
import { completeAuthorizationCodeFlow } from "../support/oauth-client.ts";
import { expectOAuthError, readJson } from "../support/http.ts";
import { startService } from "../support/service-process.ts";

test("MCP transports reject presented bearer tokens for other audiences", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const actionsFlow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const wrongAudience = bearer(actionsFlow.tokens.access_token);
  const rejectedPost = await postMcp(service, healthCall(), { sessionId, authorization: wrongAudience });
  await expectOAuthError(rejectedPost, 401, "unauthorized");
  assert.match(rejectedPost.headers.get("www-authenticate") ?? "", /resource_metadata=/);
  await expectOAuthError(await getMcp(service, sessionId, wrongAudience), 401, "unauthorized");
  await expectOAuthError(await deleteMcp(service, sessionId, wrongAudience), 401, "unauthorized");
  await expectOAuthError(await getLegacySse(service.origin, wrongAudience), 401, "unauthorized");
  await expectOAuthError(await postLegacyMessage(service.origin, wrongAudience), 401, "unauthorized");
  const recovery = await postMcp(service, { jsonrpc: "2.0", id: "recovery", method: "ping" }, { sessionId });
  assert.equal(recovery.status, 200);
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

function postLegacyMessage(origin: string, authorization: string): Promise<Response> {
  return fetch(`${origin}/messages?sessionId=bad-session`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json", origin: "https://chatgpt.com" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "health", method: "tools/call", params: { name: "health.check", arguments: {} } }),
  });
}

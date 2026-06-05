import assert from "node:assert/strict";
import test from "node:test";
import { expectOAuthError, readJson } from "../support/http.ts";
import { deleteSession, initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

test("MCP Streamable HTTP validates transport headers and session lifecycle", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const ping = await postMcp(service, { jsonrpc: "2.0", id: "ping", method: "ping" }, { sessionId });
  assert.equal(ping.status, 200);
  assert.deepEqual((await readJson(ping)).result, {});
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "bad-origin", method: "initialize", params: {} }, { origin: "https://evil.test" }), 403, "forbidden");
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "bad-type", method: "initialize", params: {} }, { contentType: "text/plain" }), 415, "bad_request");
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "bad-session", method: "ping" }, { sessionId: "bad-session" }), 400, "bad_request");
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "bad-version", method: "ping" }, { sessionId, protocolVersion: "2024-01-01" }), 400, "bad_request");
  await expectOAuthError(await getMcp(service), 400, "bad_request");
  await expectOAuthError(await getMcp(service, "bad-session"), 400, "bad_request");
  await expectOAuthError(await getMcp(service, sessionId, "2024-01-01"), 400, "bad_request");
  const stream = await getMcp(service, sessionId);
  assert.equal(stream.status, 200);
  assert.equal(stream.headers.get("content-type")?.includes("text/event-stream"), true);
  const missingMethod = await postMcp(service, { jsonrpc: "2.0", id: "missing", method: "missing/method" }, { sessionId });
  assert.equal(missingMethod.status, 200);
  assert.equal(((await readJson(missingMethod)).error as Record<string, unknown>).code, -32601);
  const deleted = await deleteSession(service, sessionId);
  assert.equal(deleted.status, 204);
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "after-delete", method: "ping" }, { sessionId }), 400, "bad_request");
});

function getMcp(service: { origin: string }, sessionId?: string, protocolVersion = "2025-11-25"): Promise<Response> {
  const headers = new Headers({ accept: "text/event-stream", origin: "https://chatgpt.com" });
  if (sessionId) headers.set("mcp-session-id", sessionId);
  if (sessionId) headers.set("mcp-protocol-version", protocolVersion);
  return fetch(`${service.origin}/mcp`, { method: "GET", headers });
}

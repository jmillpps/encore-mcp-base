import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { expectOAuthError, readJson } from "../support/http.ts";
import { deleteSession, initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

test("MCP Streamable HTTP validates transport headers and session lifecycle", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const initializedStore = await readFile(service.storePath, "utf8");
  assert.match(initializedStore, /"mcpSessions"/);
  assert.match(initializedStore, /"session_id_hash"/);
  assert.match(initializedStore, /"client_id": "test"/);
  assert.equal(initializedStore.includes("anonymous"), false);
  assert.equal(initializedStore.includes(sessionId), false);
  const ping = await postMcp(service, { jsonrpc: "2.0", id: "ping", method: "ping" }, { sessionId });
  assert.equal(ping.status, 200);
  assert.deepEqual((await readJson(ping)).result, {});
  const charsetInitialize = await postMcp(
    service,
    { jsonrpc: "2.0", id: "charset-init", method: "initialize", params: {} },
    { contentType: "application/json; charset=utf-8" },
  );
  assert.equal(charsetInitialize.status, 200);
  const invalidClientInfo = await postMcp(
    service,
    { jsonrpc: "2.0", id: "bad-client-info", method: "initialize", params: { clientInfo: { name: "bad\nclient" } } },
  );
  assert.equal(invalidClientInfo.status, 400);
  assert.equal(((await readJson(invalidClientInfo)).error as Record<string, unknown>).message, "clientInfo.name is invalid");
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "bad-origin", method: "initialize", params: {} }, { origin: "https://evil.test" }), 403, "forbidden");
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "bad-type", method: "initialize", params: {} }, { contentType: "text/plain" }), 415, "bad_request");
  await expectOAuthError(
    await postMcp(
      service,
      { jsonrpc: "2.0", id: "bad-type-suffix", method: "initialize", params: {} },
      { contentType: "application/json-seq" },
    ),
    415,
    "bad_request",
  );
  await expectOAuthError(
    await postMcp(
      service,
      { jsonrpc: "2.0", id: "bad-accept", method: "initialize", params: {} },
      { accept: "application/notapplication/json, text/event-stream" },
    ),
    400,
    "bad_request",
  );
  const malformed = await postRawMcp(service, "{");
  assert.equal(malformed.status, 400);
  assert.equal(((await readJson(malformed)).error as Record<string, unknown>).code, -32700);
  const oversized = await postRawMcp(service, JSON.stringify({ jsonrpc: "2.0", id: "oversized", method: "ping", params: { payload: "x".repeat(33000) } }));
  assert.equal(oversized.status, 413);
  assert.equal(((await readJson(oversized)).error as Record<string, unknown>).code, -32600);
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "bad-session", method: "ping" }, { sessionId: "bad-session" }), 400, "bad_request");
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "bad-version", method: "ping" }, { sessionId, protocolVersion: "2024-01-01" }), 400, "bad_request");
  await expectOAuthError(await getMcp(service), 400, "bad_request");
  await expectOAuthError(await getMcp(service, "bad-session"), 400, "bad_request");
  await expectOAuthError(await getMcp(service, sessionId, "2024-01-01"), 400, "bad_request");
  await expectOAuthError(
    await getMcp(service, sessionId, "2025-11-25", "text/event-stream-suffix"),
    400,
    "bad_request",
  );
  const stream = await getMcp(service, sessionId);
  assert.equal(stream.status, 200);
  assert.equal(stream.headers.get("content-type")?.includes("text/event-stream"), true);
  const missingMethod = await postMcp(service, { jsonrpc: "2.0", id: "missing", method: "missing/method" }, { sessionId });
  assert.equal(missingMethod.status, 200);
  assert.equal(((await readJson(missingMethod)).error as Record<string, unknown>).code, -32601);
  const missingMethodWithInvalidParams = await postMcp(service, { jsonrpc: "2.0", id: "missing-invalid-params", method: "missing/method", params: [] }, { sessionId });
  assert.equal(missingMethodWithInvalidParams.status, 200);
  assert.equal(((await readJson(missingMethodWithInvalidParams)).error as Record<string, unknown>).code, -32601);
  const deleted = await deleteSession(service, sessionId);
  assert.equal(deleted.status, 204);
  assert.match(await readFile(service.storePath, "utf8"), /"terminated_at"/);
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "after-delete", method: "ping" }, { sessionId }), 400, "bad_request");
});

function getMcp(service: { origin: string }, sessionId?: string, protocolVersion = "2025-11-25", accept = "text/event-stream"): Promise<Response> {
  const headers = new Headers({ accept, origin: "https://chatgpt.com" });
  if (sessionId) headers.set("mcp-session-id", sessionId);
  if (sessionId) headers.set("mcp-protocol-version", protocolVersion);
  return fetch(`${service.origin}/mcp`, { method: "GET", headers });
}

function postRawMcp(service: { origin: string }, body: string): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "POST",
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json", origin: "https://chatgpt.com" },
    body,
  });
}

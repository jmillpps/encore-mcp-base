import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertExposesHeader, expectOAuthError, readJson, requireString } from "../support/http.ts";
import { deleteSession, initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";
import { assertSseOpen, SseReader } from "../support/sse.ts";

test("MCP Streamable HTTP validates transport headers and session lifecycle", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service, { sendInitialized: false });
  const initializedStore = await readFile(service.storePath, "utf8");
  assert.match(initializedStore, /"mcpSessions"/);
  assert.match(initializedStore, /"session_id_hash"/);
  assert.match(initializedStore, /"client_id": "test"/);
  assert.equal(initializedStore.includes("initialized_at"), false);
  assert.equal(initializedStore.includes("anonymous"), false);
  assert.equal(initializedStore.includes(sessionId), false);
  const initializeWithSession = await postMcp(
    service,
    { jsonrpc: "2.0", id: "init-with-session", method: "initialize", params: initializeParams({ clientInfo: { name: "session-init", version: "0.1.0" } }) },
    { sessionId },
  );
  const initializeWithSessionError = await expectOAuthError(initializeWithSession, 400, "bad_request");
  assert.match(String(initializeWithSessionError.error_description), /session/);
  const init = await postMcp(service, { jsonrpc: "2.0", id: "init-instructions", method: "initialize", params: initializeParams({ clientInfo: { name: "instruction-test", version: "0.1.0" } }) });
  assert.equal(init.status, 200);
  const initInstructions = requireString(((await readJson(init)).result as Record<string, unknown>).instructions, "instructions");
  assert.ok(initInstructions.length > 0);
  assert.ok(initInstructions.length <= 512);
  assert.match(initInstructions, /health\.check/);
  assert.match(initInstructions, /identity\.profile/);
  assert.match(initInstructions, /auth\.session/);
  const ping = await postMcp(service, { jsonrpc: "2.0", id: "ping", method: "ping" }, { sessionId });
  assert.equal(ping.status, 200);
  assert.deepEqual((await readJson(ping)).result, {});
  const blockedBeforeInitialized = await postMcp(service, { jsonrpc: "2.0", id: "pre-init-tools", method: "tools/list" }, { sessionId });
  assert.equal(blockedBeforeInitialized.status, 200);
  const blockedBeforeInitializedError = (await readJson(blockedBeforeInitialized)).error as Record<string, unknown>;
  assert.equal(blockedBeforeInitializedError.code, -32002);
  const clientResponse = await postMcp(service, { jsonrpc: "2.0", id: "server-request", result: { accepted: true } }, { sessionId });
  assert.equal(clientResponse.status, 202);
  assert.equal(await clientResponse.text(), "");
  const initializedNotification = await postMcp(service, { jsonrpc: "2.0", method: "notifications/initialized" }, { sessionId });
  assert.equal(initializedNotification.status, 202);
  assert.equal(await initializedNotification.text(), "");
  assert.match(await readFile(service.storePath, "utf8"), /"initialized_at"/);
  const oldVersionInitialize = await postMcp(
    service,
    { jsonrpc: "2.0", id: "old-version-init", method: "initialize", params: initializeParams({ protocolVersion: "2025-06-18", clientInfo: { name: "old-test", version: "0.1.0" } }) },
  );
  assert.equal(oldVersionInitialize.status, 200);
  assert.equal(((await readJson(oldVersionInitialize)).result as Record<string, unknown>).protocolVersion, "2025-11-25");
  const charsetInitialize = await postMcp(
    service,
    { jsonrpc: "2.0", id: "charset-init", method: "initialize", params: initializeParams({ clientInfo: { name: "charset-test", version: "0.1.0" } }) },
    { contentType: "application/json; charset=utf-8" },
  );
  assert.equal(charsetInitialize.status, 200);
  assertExposesHeader(charsetInitialize, "mcp-session-id");
  assert.match(charsetInitialize.headers.get("access-control-allow-headers") ?? "", /MCP-Session-Id/);
  assert.match(charsetInitialize.headers.get("access-control-allow-headers") ?? "", /MCP-Protocol-Version/);
  await expectOAuthError(
    await postMcp(
      service,
      { jsonrpc: "2.0", id: "bad-charset", method: "initialize", params: initializeParams({ clientInfo: { name: "bad-charset", version: "0.1.0" } }) },
      { contentType: "application/json; charset=iso-8859-1" },
    ),
    415,
    "bad_request",
  );
  const validPreflight = await optionsMcp(service.origin, "https://chatgpt.com");
  assert.ok(validPreflight.status === 200 || validPreflight.status === 204);
  assert.equal(validPreflight.headers.get("access-control-allow-origin"), "https://chatgpt.com");
  const missingProtocolVersion = await postMcp(service, { jsonrpc: "2.0", id: "missing-version", method: "initialize", params: initializeParams({ protocolVersion: undefined }) });
  assert.equal(missingProtocolVersion.status, 400);
  assert.equal(((await readJson(missingProtocolVersion)).error as Record<string, unknown>).message, "protocolVersion is required");
  const missingCapabilities = await postMcp(service, { jsonrpc: "2.0", id: "missing-capabilities", method: "initialize", params: initializeParams({ capabilities: undefined }) });
  assert.equal(missingCapabilities.status, 400);
  assert.equal(((await readJson(missingCapabilities)).error as Record<string, unknown>).message, "capabilities must be an object");
  const missingClientInfoVersion = await postMcp(
    service,
    { jsonrpc: "2.0", id: "missing-client-version", method: "initialize", params: initializeParams({ clientInfo: { name: "bad-client" } }) },
  );
  assert.equal(missingClientInfoVersion.status, 400);
  assert.equal(((await readJson(missingClientInfoVersion)).error as Record<string, unknown>).message, "version is required");
  const invalidClientInfo = await postMcp(
    service,
    { jsonrpc: "2.0", id: "bad-client-info", method: "initialize", params: initializeParams({ clientInfo: { name: "bad\nclient", version: "0.1.0" } }) },
  );
  assert.equal(invalidClientInfo.status, 400);
  assert.equal(((await readJson(invalidClientInfo)).error as Record<string, unknown>).message, "clientInfo.name is invalid");
  const invalidClientVersion = await postMcp(
    service,
    { jsonrpc: "2.0", id: "bad-client-version", method: "initialize", params: initializeParams({ clientInfo: { name: "bad-client", version: "bad\nversion" } }) },
  );
  assert.equal(invalidClientVersion.status, 400);
  assert.equal(((await readJson(invalidClientVersion)).error as Record<string, unknown>).message, "clientInfo.version is invalid");
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
  const malformedBody = await readJson(malformed);
  assert.equal((malformedBody.error as Record<string, unknown>).code, -32700);
  assert.equal(Object.hasOwn(malformedBody, "id"), false);
  const invalidUtf8 = await postRawMcp(service, Buffer.from([0xff]));
  assert.equal(invalidUtf8.status, 400);
  const invalidUtf8Body = await readJson(invalidUtf8);
  assert.equal((invalidUtf8Body.error as Record<string, unknown>).message, "invalid utf-8");
  assert.equal(Object.hasOwn(invalidUtf8Body, "id"), false);
  const invalidNullId = await postMcp(service, { jsonrpc: "2.0", id: null, method: "ping" }, { sessionId });
  assert.equal(invalidNullId.status, 400);
  const invalidNullIdBody = await readJson(invalidNullId);
  assert.equal((invalidNullIdBody.error as Record<string, unknown>).code, -32600);
  assert.equal(Object.hasOwn(invalidNullIdBody, "id"), false);
  const clientErrorResponse = await postMcp(service, { jsonrpc: "2.0", error: { code: -32603, message: "client error" } }, { sessionId });
  assert.equal(clientErrorResponse.status, 202);
  assert.equal(await clientErrorResponse.text(), "");
  const invalidClientResponseId = await postMcp(service, { jsonrpc: "2.0", id: null, result: { accepted: true } }, { sessionId });
  assert.equal(invalidClientResponseId.status, 400);
  const invalidClientResponseIdBody = await readJson(invalidClientResponseId);
  assert.equal((invalidClientResponseIdBody.error as Record<string, unknown>).code, -32600);
  assert.equal(Object.hasOwn(invalidClientResponseIdBody, "id"), false);
  const oversized = await postRawMcp(service, JSON.stringify({ jsonrpc: "2.0", id: "oversized", method: "ping", params: { payload: "x".repeat(33000) } }));
  assert.equal(oversized.status, 413);
  assert.equal(((await readJson(oversized)).error as Record<string, unknown>).code, -32600);
  const toolsList = await postMcp(service, { jsonrpc: "2.0", id: "tools-list", method: "tools/list", params: { _meta: { progressToken: "list-progress" } } }, { sessionId });
  assert.equal(toolsList.status, 200);
  const toolsListResult = (await readJson(toolsList)).result as Record<string, unknown>;
  assert.equal(Array.isArray(toolsListResult.tools), true);
  assert.equal(Object.hasOwn(toolsListResult, "nextCursor"), false);
  const badListParams = await postMcp(service, { jsonrpc: "2.0", id: "bad-list-params", method: "tools/list", params: [] }, { sessionId });
  assert.equal(badListParams.status, 400);
  assert.equal(((await readJson(badListParams)).error as Record<string, unknown>).code, -32600);
  const badListCursor = await postMcp(service, { jsonrpc: "2.0", id: "bad-list-cursor", method: "tools/list", params: { cursor: "never-issued" } }, { sessionId });
  assert.equal(badListCursor.status, 200);
  assert.equal(((await readJson(badListCursor)).error as Record<string, unknown>).code, -32602);
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "bad-session", method: "ping" }, { sessionId: "bad-session" }), 400, "bad_request");
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "bad-version", method: "ping" }, { sessionId, protocolVersion: "2024-01-01" }), 400, "bad_request");
  await expectOAuthError(await getMcp(service, sessionId, "2025-11-25", "text/event-stream", undefined, "https://evil.test"), 403, "forbidden");
  await expectOAuthError(await getMcp(service), 400, "bad_request");
  await expectOAuthError(await getMcp(service, "bad-session"), 400, "bad_request");
  await expectOAuthError(await getMcp(service, sessionId, "2024-01-01"), 400, "bad_request");
  await expectOAuthError(
    await getMcp(service, sessionId, "2025-11-25", "text/event-stream-suffix"),
    400,
    "bad_request",
  );
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await getMcp(service, sessionId, "2025-11-25", "text/event-stream", controller.signal);
  assert.equal(stream.status, 200);
  assert.equal(stream.headers.get("content-type")?.includes("text/event-stream"), true);
  assert.ok(stream.body);
  await assertSseOpen(new SseReader(stream.body.getReader()));
  controller.abort();
  const missingMethod = await postMcp(service, { jsonrpc: "2.0", id: "missing", method: "missing/method" }, { sessionId });
  assert.equal(missingMethod.status, 200);
  assert.equal(((await readJson(missingMethod)).error as Record<string, unknown>).code, -32601);
  const missingMethodWithInvalidParams = await postMcp(service, { jsonrpc: "2.0", id: "missing-invalid-params", method: "missing/method", params: [] }, { sessionId });
  assert.equal(missingMethodWithInvalidParams.status, 400);
  assert.equal(((await readJson(missingMethodWithInvalidParams)).error as Record<string, unknown>).code, -32600);
  await expectOAuthError(await deleteMcp(service, sessionId, "https://evil.test"), 403, "forbidden");
  const deleted = await deleteSession(service, sessionId);
  assert.equal(deleted.status, 204);
  assert.match(await readFile(service.storePath, "utf8"), /"terminated_at"/);
  await expectOAuthError(await postMcp(service, { jsonrpc: "2.0", id: "after-delete", method: "ping" }, { sessionId }), 404, "not_found");
});

test("MCP Streamable HTTP rejects unsafe numeric JSON-RPC ids", async (t) => {
  const service = await startService(t);
  for (const id of ["1e999", "9007199254740993", "1.5"]) {
    const response = await postRawMcp(service, `{"jsonrpc":"2.0","id":${id},"method":"initialize","params":${JSON.stringify(initializeParams())}}`);
    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal((body.error as Record<string, unknown>).code, -32600);
    assert.equal(Object.hasOwn(body, "id"), false);
  }
});

test("MCP Streamable HTTP rejects non-object JSON-RPC params", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  for (const message of [
    { jsonrpc: "2.0", id: "array-params", method: "ping", params: [] },
    { jsonrpc: "2.0", id: "null-params", method: "ping", params: null },
    { jsonrpc: "2.0", method: "notifications/initialized", params: [] },
  ]) {
    const response = await postMcp(service, message, { sessionId });
    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal((body.error as Record<string, unknown>).code, -32600);
    assert.equal(Object.hasOwn(body, "id"), false);
  }
});

function getMcp(
  service: { origin: string },
  sessionId?: string,
  protocolVersion = "2025-11-25",
  accept = "text/event-stream",
  signal?: AbortSignal,
  origin = "https://chatgpt.com",
): Promise<Response> {
  const headers = new Headers({ accept, origin });
  if (sessionId) headers.set("mcp-session-id", sessionId);
  if (sessionId) headers.set("mcp-protocol-version", protocolVersion);
  return fetch(`${service.origin}/mcp`, { method: "GET", headers, signal });
}

function deleteMcp(service: { origin: string }, sessionId: string, origin = "https://chatgpt.com"): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "DELETE",
    headers: { origin, "mcp-session-id": sessionId, "mcp-protocol-version": "2025-11-25" },
  });
}

function postRawMcp(service: { origin: string }, body: string | Buffer): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "POST",
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json", origin: "https://chatgpt.com" },
    body,
  });
}

function optionsMcp(origin: string, requestOrigin: string): Promise<Response> {
  return fetch(`${origin}/mcp`, {
    method: "OPTIONS",
    headers: {
      origin: requestOrigin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type,mcp-session-id,mcp-protocol-version",
    },
  });
}

function initializeParams(overrides: { protocolVersion?: string; capabilities?: Record<string, unknown>; clientInfo?: Record<string, unknown> } = {}): Record<string, unknown> {
  return {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "test", version: "0.1.0" },
    ...overrides,
  };
}

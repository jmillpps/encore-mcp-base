import assert from "node:assert/strict";
import test from "node:test";
import { expectOAuthError, readJson } from "../support/http.ts";
import { initializeMcp, mcpAuthorization, postMcp } from "../support/mcp.ts";
import { startService, type TestService } from "../support/service-process.ts";

test("MCP Streamable HTTP rejects unacceptable Accept quality values", async (t) => {
  const service = await startService(t);
  await expectOAuthError(
    await postMcp(
      service,
      { jsonrpc: "2.0", id: "json-unacceptable", method: "initialize", params: initializeParams("accept-json") },
      { accept: "application/json;q=0, text/event-stream" },
    ),
    400,
    "bad_request",
  );
  await expectOAuthError(
    await postMcp(
      service,
      { jsonrpc: "2.0", id: "sse-unacceptable", method: "initialize", params: initializeParams("accept-sse") },
      { accept: "application/json, text/event-stream;q=0" },
    ),
    400,
    "bad_request",
  );
  const sessionId = await initializeMcp(service);
  await expectOAuthError(await getMcp(service, sessionId, "text/event-stream;q=0"), 400, "bad_request");
  const ping = await postMcp(service, { jsonrpc: "2.0", id: "accept-q-ping", method: "ping" }, { sessionId, accept: "application/json;q=1, text/event-stream;q=0.5" });
  assert.equal(ping.status, 200);
  assert.deepEqual((await readJson(ping)).result, {});
});

test("MCP Streamable HTTP accepts wildcard media ranges", async (t) => {
  const service = await startService(t);
  const initialize = await postMcp(
    service,
    { jsonrpc: "2.0", id: "wildcard-initialize", method: "initialize", params: initializeParams("wildcard") },
    { accept: "application/*; q=0.9, text/*;q=0.8" },
  );
  assert.equal(initialize.status, 200);
  const sessionId = initialize.headers.get("mcp-session-id");
  assert.equal(typeof sessionId, "string");
  assert.notEqual(sessionId, "");
  const initialized = await postMcp(service, { jsonrpc: "2.0", method: "notifications/initialized" }, { sessionId: String(sessionId), accept: "*/*;q=1" });
  assert.equal(initialized.status, 202);
  const ping = await postMcp(service, { jsonrpc: "2.0", id: "wildcard-ping", method: "ping" }, { sessionId: String(sessionId), accept: "*/*; q=1" });
  assert.equal(ping.status, 200);
  assert.deepEqual((await readJson(ping)).result, {});
  const stream = await getMcp(service, String(sessionId), "application/json;q=0.1, text/*;q=1");
  assert.equal(stream.status, 200);
  await stream.body?.cancel();
});

function initializeParams(clientName: string): Record<string, unknown> {
  return { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: clientName, version: "0.1.0" } };
}

async function getMcp(service: TestService, sessionId: string, accept: string): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "GET",
    headers: { accept, authorization: await mcpAuthorization(service), origin: "https://chatgpt.com", "mcp-session-id": sessionId, "mcp-protocol-version": "2025-11-25" },
  });
}

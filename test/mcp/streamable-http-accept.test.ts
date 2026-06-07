import assert from "node:assert/strict";
import test from "node:test";
import { expectOAuthError, readJson } from "../support/http.ts";
import { initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

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

function initializeParams(clientName: string): Record<string, unknown> {
  return { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: clientName, version: "0.1.0" } };
}

function getMcp(service: { origin: string }, sessionId: string, accept: string): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "GET",
    headers: { accept, origin: "https://chatgpt.com", "mcp-session-id": sessionId, "mcp-protocol-version": "2025-11-25" },
  });
}

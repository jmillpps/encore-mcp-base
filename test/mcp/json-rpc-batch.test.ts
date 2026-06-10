import assert from "node:assert/strict";
import test from "node:test";
import { readJson } from "../support/http.ts";
import { initializeMcp, mcpAuthorization } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

test("MCP Streamable HTTP rejects JSON-RPC batch arrays", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const headers = new Headers({
    accept: "application/json, text/event-stream",
    authorization: await mcpAuthorization(service),
    "content-type": "application/json",
    origin: "https://chatgpt.com",
    "mcp-session-id": sessionId,
    "mcp-protocol-version": "2025-11-25",
  });
  const response = await fetch(`${service.origin}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify([{ jsonrpc: "2.0", id: "batch-ping", method: "ping" }]),
  });
  assert.equal(response.status, 400);
  const body = await readJson(response);
  assert.equal((body.error as Record<string, unknown>).code, -32600);
  assert.equal(Object.hasOwn(body, "id"), false);
});

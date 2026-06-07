import assert from "node:assert/strict";
import test from "node:test";
import { readJson } from "../support/http.ts";
import { mcpAuthorization } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";
import { SseReader } from "../support/sse.ts";

test("MCP Streamable HTTP rejects access tokens in the URI query", async (t) => {
  const service = await startService(t);
  const response = await fetch(`${service.origin}/mcp?access_token=leaked`, {
    method: "POST",
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json", origin: "https://chatgpt.com" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "init", method: "initialize", params: initializeParams() }),
  });
  await expectBadRequest(response);
});

test("MCP SSE receive stream rejects access tokens in the URI query", async (t) => {
  const service = await startService(t);
  const response = await fetch(`${service.origin}/sse?access_token=leaked`, {
    headers: { accept: "text/event-stream", origin: "https://chatgpt.com" },
  });
  await expectBadRequest(response);
});

test("MCP legacy messages reject access tokens in the URI query", async (t) => {
  const service = await startService(t);
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(`${service.origin}/sse`, {
    signal: controller.signal,
    headers: { accept: "text/event-stream", authorization: await mcpAuthorization(service), origin: "https://chatgpt.com" },
  });
  assert.equal(stream.status, 200);
  assert.ok(stream.body);
  const endpoint = (await new SseReader(stream.body.getReader()).readEvent()).data;
  const separator = endpoint.includes("?") ? "&" : "?";
  const response = await fetch(`${service.origin}${endpoint}${separator}access_token=leaked`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://chatgpt.com" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "ping", method: "ping" }),
  });
  await expectBadRequest(response);
});

async function expectBadRequest(response: Response): Promise<void> {
  assert.equal(response.status, 400);
  const body = await readJson(response);
  assert.equal(body.error, "bad_request");
  assert.equal(body.error_description, "access tokens must use the authorization header");
}

function initializeParams(): Record<string, unknown> {
  return { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "query-token-test", version: "0.1.0" } };
}

import assert from "node:assert/strict";
import test from "node:test";
import { readJson } from "../support/http.ts";
import { initializeMcp, mcpAuthorization } from "../support/mcp.ts";
import { startService, type TestService } from "../support/service-process.ts";
import { assertSseOpen, SseReader } from "../support/sse.ts";

test("MCP Streamable HTTP uses the stored session protocol when the header is absent", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const ping = await postMcpWithoutProtocol(service, sessionId, { jsonrpc: "2.0", id: "ping-without-version", method: "ping" });
  assert.equal(ping.status, 200);
  assert.deepEqual((await readJson(ping)).result, {});
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await getMcpWithoutProtocol(service, sessionId, controller.signal);
  assert.equal(stream.status, 200);
  assert.equal(stream.headers.get("content-type")?.includes("text/event-stream"), true);
  assert.ok(stream.body);
  await assertSseOpen(new SseReader(stream.body.getReader()));
  controller.abort();
  const deleted = await deleteMcpWithoutProtocol(service, sessionId);
  assert.equal(deleted.status, 204);
});

async function getMcpWithoutProtocol(service: TestService, sessionId: string, signal?: AbortSignal): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "GET",
    headers: { accept: "text/event-stream", authorization: await mcpAuthorization(service), origin: "https://chatgpt.com", "mcp-session-id": sessionId },
    signal,
  });
}

async function deleteMcpWithoutProtocol(service: TestService, sessionId: string): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "DELETE",
    headers: { authorization: await mcpAuthorization(service), origin: "https://chatgpt.com", "mcp-session-id": sessionId },
  });
}

async function postMcpWithoutProtocol(service: TestService, sessionId: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "POST",
    headers: { accept: "application/json, text/event-stream", authorization: await mcpAuthorization(service), "content-type": "application/json", origin: "https://chatgpt.com", "mcp-session-id": sessionId },
    body: JSON.stringify(body),
  });
}

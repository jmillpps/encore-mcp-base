import assert from "node:assert/strict";
import test from "node:test";
import { expectOAuthError } from "../support/http.ts";
import { initializeMcp, mcpAuthorization } from "../support/mcp.ts";
import { startService, type TestService } from "../support/service-process.ts";
import { assertSseOpen, SseReader } from "../support/sse.ts";

test("legacy SSE rejects streams beyond the configured connection limit", async (t) => {
  const service = await startService(t, { MCP_SSE_MAX_CONNECTIONS: "1" });
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(`${service.origin}/sse`, {
    signal: controller.signal,
    headers: { accept: "text/event-stream", authorization: await mcpAuthorization(service), origin: "https://chatgpt.com" },
  });
  assert.equal(stream.status, 200);
  assert.ok(stream.body);
  const endpoint = await new SseReader(stream.body.getReader()).readEvent();
  assert.equal(endpoint.event, "endpoint");
  await expectOAuthError(
    await fetch(`${service.origin}/sse`, { headers: { accept: "text/event-stream", authorization: await mcpAuthorization(service), origin: "https://chatgpt.com" } }),
    429,
    "rate_limited",
  );
});

test("Streamable HTTP SSE rejects streams beyond the configured connection limit", async (t) => {
  const service = await startService(t, { MCP_SSE_MAX_CONNECTIONS: "1" });
  const sessionId = await initializeMcp(service);
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await getMcpStream(service, sessionId, controller.signal);
  assert.equal(stream.status, 200);
  assert.ok(stream.body);
  await assertSseOpen(new SseReader(stream.body.getReader()));
  await expectOAuthError(await getMcpStream(service, sessionId), 429, "rate_limited");
});

async function getMcpStream(service: TestService, sessionId: string, signal?: AbortSignal): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "GET",
    headers: {
      accept: "text/event-stream",
      authorization: await mcpAuthorization(service),
      origin: "https://chatgpt.com",
      "mcp-session-id": sessionId,
      "mcp-protocol-version": "2025-11-25",
    },
    signal,
  });
}

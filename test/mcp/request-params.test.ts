import assert from "node:assert/strict";
import test from "node:test";
import { readJson, requireRecord } from "../support/http.ts";
import { initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";
import { assertSseOpen, SseReader } from "../support/sse.ts";

test("MCP Streamable HTTP validates request metadata params", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const validPing = await postMcp(service, { jsonrpc: "2.0", id: "valid-ping", method: "ping", params: { _meta: { progressToken: "progress-1", trace: { id: "abc" } } } }, { sessionId });
  assert.equal(validPing.status, 200);
  assert.deepEqual((await readJson(validPing)).result, {});
  await expectJsonRpcError(
    await postMcp(service, { jsonrpc: "2.0", id: "unsupported-ping", method: "ping", params: { unsupported: true } }, { sessionId }),
    -32602,
  );
  await expectJsonRpcError(await postMcp(service, { jsonrpc: "2.0", id: "bad-ping-meta", method: "ping", params: { _meta: [] } }, { sessionId }), -32602);
  await expectJsonRpcError(
    await postMcp(service, { jsonrpc: "2.0", id: "bad-ping-progress", method: "ping", params: { _meta: { progressToken: [] } } }, { sessionId }),
    -32602,
  );
  const validList = await postMcp(service, { jsonrpc: "2.0", id: "valid-list", method: "tools/list", params: { _meta: { progressToken: 7 } } }, { sessionId });
  assert.equal(validList.status, 200);
  assert.equal(Array.isArray(requireRecord((await readJson(validList)).result, "tools/list result").tools), true);
  await expectJsonRpcError(
    await postMcp(service, { jsonrpc: "2.0", id: "bad-list-progress", method: "tools/list", params: { _meta: { progressToken: {} } } }, { sessionId }),
    -32602,
  );
  await expectJsonRpcError(
    await postMcp(service, { jsonrpc: "2.0", id: "bad-tool-progress", method: "tools/call", params: { name: "health.check", _meta: { progressToken: false } } }, { sessionId }),
    -32602,
  );
});

test("MCP legacy HTTP SSE sends request parameter errors on the receive stream", async (t) => {
  const service = await startService(t);
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(`${service.origin}/sse`, {
    signal: controller.signal,
    headers: { accept: "text/event-stream", origin: "https://chatgpt.com" },
  });
  assert.equal(stream.status, 200);
  assert.ok(stream.body);
  const events = new SseReader(stream.body.getReader());
  const endpoint = (await events.readEvent()).data;
  await assertSseOpen(events);
  const invalid = await postLegacyMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "unsupported-ping", method: "ping", params: { unsupported: true } });
  assert.equal(invalid.status, 202);
  assert.equal(await invalid.text(), "");
  assert.equal(requireRecord(JSON.parse((await events.readEvent()).data).error, "json-rpc error").code, -32602);
  const recovery = await postLegacyMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "recovery", method: "ping", params: { _meta: { progressToken: "recovery" } } });
  assert.equal(recovery.status, 202);
  assert.deepEqual(JSON.parse((await events.readEvent()).data).result, {});
});

async function expectJsonRpcError(response: Response, code: number): Promise<void> {
  assert.equal(response.status, 200);
  assert.equal(requireRecord((await readJson(response)).error, "json-rpc error").code, code);
}

function postLegacyMessage(origin: string, endpoint: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${origin}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://chatgpt.com" },
    body: JSON.stringify(body),
  });
}

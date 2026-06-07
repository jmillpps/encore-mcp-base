import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readJson, requireRecord } from "../support/http.ts";
import { initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";
import { assertSseOpen, SseReader } from "../support/sse.ts";

test("MCP Streamable HTTP rejects duplicate JSON-RPC request ids within a session", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const first = await postMcp(service, { jsonrpc: "2.0", id: "repeat-id", method: "ping" }, { sessionId });
  assert.deepEqual((await readJson(first)).result, {});
  const persisted = await readFile(service.storePath, "utf8");
  assert.match(persisted, /request_id_hashes_json/);
  assert.equal(persisted.includes("repeat-id"), false);
  const duplicate = await postMcp(service, { jsonrpc: "2.0", id: "repeat-id", method: "ping" }, { sessionId });
  assert.equal(requireRecord((await readJson(duplicate)).error, "json-rpc error").code, -32600);
  const recovery = await postMcp(service, { jsonrpc: "2.0", id: "unique-id", method: "ping" }, { sessionId });
  assert.deepEqual((await readJson(recovery)).result, {});
});

test("MCP legacy SSE rejects duplicate JSON-RPC request ids within a session", async (t) => {
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
  assert.equal((await postMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "repeat-id", method: "ping" })).status, 202);
  assert.deepEqual(JSON.parse((await events.readEvent()).data).result, {});
  assert.equal((await postMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "repeat-id", method: "ping" })).status, 202);
  assert.equal(requireRecord(JSON.parse((await events.readEvent()).data).error, "json-rpc error").code, -32600);
  assert.equal((await postMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "unique-id", method: "ping" })).status, 202);
  assert.deepEqual(JSON.parse((await events.readEvent()).data).result, {});
});

function postMessage(origin: string, endpoint: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${origin}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://chatgpt.com" },
    body: JSON.stringify(body),
  });
}

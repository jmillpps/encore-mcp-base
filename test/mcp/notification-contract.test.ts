import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readJson, requireRecord } from "../support/http.ts";
import { initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";
import { SseReader } from "../support/sse.ts";

test("MCP Streamable HTTP validates notification methods and params", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  for (const message of [
    { jsonrpc: "2.0", method: "notifications/tools/list_changed" },
    { jsonrpc: "2.0", method: "notifications/cancelled" },
    { jsonrpc: "2.0", method: "notifications/cancelled", params: {} },
    { jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: null } },
    { jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: "request-1", reason: 1 } },
    { jsonrpc: "2.0", method: "notifications/roots/list_changed", params: { _meta: { "openai//locale": "en-US" } } },
    { jsonrpc: "2.0", method: "notifications/roots/list_changed", params: { _meta: { "com.mcp.tools/trace": true } } },
  ]) {
    await expectInvalidNotification(await postMcp(service, message, { sessionId }));
  }
  for (const message of [
    { jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: "request-1", reason: "client cancelled" } },
    { jsonrpc: "2.0", method: "notifications/roots/list_changed", params: { _meta: {} } },
  ]) {
    const accepted = await postMcp(service, message, { sessionId });
    assert.equal(accepted.status, 202);
    assert.equal(await accepted.text(), "");
  }
});

test("MCP legacy messages deliver notification contract errors on the receive stream", async (t) => {
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
  const response = await fetch(`${service.origin}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://chatgpt.com" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" }),
  });
  assert.equal(response.status, 202);
  assert.equal(requireRecord(JSON.parse((await events.readEvent()).data).error, "json-rpc error").code, -32600);
});

async function expectInvalidNotification(response: Response): Promise<void> {
  assert.equal(response.status, 400);
  const body = await readJson(response);
  assert.equal(requireRecord(body.error, "json-rpc error").code, -32600);
  assert.equal(Object.hasOwn(body, "id"), false);
}

test("MCP Streamable HTTP initializes sessions only after a valid initialized notification", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service, { sendInitialized: false });
  assert.equal((await readFile(service.storePath, "utf8")).includes("initialized_at"), false);
  const invalidRequest = await postMcp(service, { jsonrpc: "2.0", id: "invalid-initialized", method: "notifications/initialized" }, { sessionId });
  assert.equal(invalidRequest.status, 200);
  assert.equal(requireRecord((await readJson(invalidRequest)).error, "json-rpc error").code, -32601);
  assert.equal((await readFile(service.storePath, "utf8")).includes("initialized_at"), false);
  const invalidParams = await postMcp(service, { jsonrpc: "2.0", method: "notifications/initialized", params: [] }, { sessionId });
  assert.equal(invalidParams.status, 400);
  assert.equal((await readFile(service.storePath, "utf8")).includes("initialized_at"), false);
  const blocked = await postMcp(service, { jsonrpc: "2.0", id: "blocked-tools", method: "tools/list" }, { sessionId });
  assert.equal(requireRecord((await readJson(blocked)).error, "json-rpc error").code, -32002);
});

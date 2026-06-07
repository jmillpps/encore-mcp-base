import assert from "node:assert/strict";
import test from "node:test";
import { readJson, requireRecord } from "../support/http.ts";
import { initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";
import { SseReader } from "../support/sse.ts";

const collisionBody = { status: 207, body: { accepted: true } };
const requestResultCollision = { jsonrpc: "2.0", id: "request-result-collision", method: "ping", result: { accepted: true } };
const requestErrorCollision = { jsonrpc: "2.0", id: "request-error-collision", method: "ping", error: { code: -32603, message: "client error" } };
const requestExtraField = { jsonrpc: "2.0", id: "request-extra-field", method: "ping", trace: { id: "smuggled" } };
const responseExtraField = { jsonrpc: "2.0", id: "response-extra-field", result: { accepted: true }, trace: { id: "smuggled" } };
const responseErrorExtraField = { jsonrpc: "2.0", id: "response-error-extra-field", error: { code: -32603, message: "client error", trace: { id: "smuggled" } } };

test("MCP Streamable HTTP rejects client JSON shaped like an internal body result", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  await expectInvalidJsonRpcMessage(await postMcp(service, collisionBody, { sessionId }));
});

test("MCP Streamable HTTP rejects JSON-RPC requests that also contain responses", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  await expectInvalidJsonRpcMessage(await postMcp(service, requestResultCollision, { sessionId }));
  await expectInvalidJsonRpcMessage(await postMcp(service, requestErrorCollision, { sessionId }));
});

test("MCP Streamable HTTP rejects JSON-RPC envelopes with unsupported fields", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  for (const message of [requestExtraField, responseExtraField, responseErrorExtraField]) {
    await expectInvalidJsonRpcMessage(await postMcp(service, message, { sessionId }));
  }
});

test("SSE messages reject client JSON shaped like an internal body result", async (t) => {
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
    body: JSON.stringify(collisionBody),
  });
  assert.equal(response.status, 202);
  assert.equal(requireRecord(JSON.parse((await events.readEvent()).data).error, "json-rpc error").code, -32600);
});

test("SSE messages reject JSON-RPC requests that also contain responses", async (t) => {
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
  for (const message of [requestResultCollision, requestErrorCollision]) {
    const response = await fetch(`${service.origin}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://chatgpt.com" },
      body: JSON.stringify(message),
    });
    assert.equal(response.status, 202);
    assert.equal(requireRecord(JSON.parse((await events.readEvent()).data).error, "json-rpc error").code, -32600);
  }
});

test("SSE messages reject JSON-RPC envelopes with unsupported fields", async (t) => {
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
  for (const message of [requestExtraField, responseExtraField, responseErrorExtraField]) {
    const response = await fetch(`${service.origin}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://chatgpt.com" },
      body: JSON.stringify(message),
    });
    assert.equal(response.status, 202);
    assert.equal(requireRecord(JSON.parse((await events.readEvent()).data).error, "json-rpc error").code, -32600);
  }
});

async function expectInvalidJsonRpcMessage(response: Response): Promise<void> {
  assert.equal(response.status, 400);
  const body = await readJson(response);
  assert.equal(requireRecord(body.error, "json-rpc error").code, -32600);
  assert.equal(Object.hasOwn(body, "id"), false);
}

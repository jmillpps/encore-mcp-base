import assert from "node:assert/strict";
import test from "node:test";
import { expectOAuthError, readJson, requireRecord } from "../support/http.ts";
import { startService } from "../support/service-process.ts";
import { assertSseOpen, SseReader } from "../support/sse.ts";

test("SSE transport keeps the receive stream open and sends JSON-RPC responses as events", async (t) => {
  const service = await startService(t);
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(`${service.origin}/sse`, {
    signal: controller.signal,
    headers: { accept: "text/event-stream", origin: "https://chatgpt.com" },
  });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get("content-type") ?? "", /text\/event-stream/);
  assert.ok(stream.body);
  const events = new SseReader(stream.body.getReader());
  const endpoint = await events.readEvent();
  assert.equal(endpoint.event, "endpoint");
  assert.match(endpoint.data, /^\/messages\?sessionId=/);
  await assertSseOpen(events);
  const message = await postMessage(service.origin, endpoint.data, { jsonrpc: "2.0", id: "ping", method: "ping" });
  assert.equal(message.status, 202);
  assert.equal(await message.text(), "");
  const ping = await events.readEvent();
  assert.equal(ping.event, "message");
  assert.ok(ping.id);
  assert.deepEqual(JSON.parse(ping.data).result, {});
  const protectedMessage = await postMessage(service.origin, endpoint.data, {
    jsonrpc: "2.0",
    id: "identity.profile",
    method: "tools/call",
    params: { name: "identity.profile", arguments: {} },
  });
  assert.equal(protectedMessage.status, 202);
  assert.match(protectedMessage.headers.get("www-authenticate") ?? "", /resource_metadata=/);
  const protectedEvent = await events.readEvent();
  assert.equal(requireRecord(JSON.parse(protectedEvent.data).result, "protected result").isError, true);
});

test("SSE transport accepts multiple client JSON-RPC message forms", async (t) => {
  const service = await startService(t);
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(`${service.origin}/sse`, {
    signal: controller.signal,
    headers: { accept: "text/event-stream", origin: "https://chatgpt.com" },
  });
  assert.ok(stream.body);
  const events = new SseReader(stream.body.getReader());
  const endpoint = (await events.readEvent()).data;
  const notification = await postMessage(service.origin, endpoint, { jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(notification.status, 202);
  assert.equal(await notification.text(), "");
  const response = await postMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "server-request", result: { ok: true } });
  assert.equal(response.status, 202);
  assert.equal(await response.text(), "");
  const message = await postMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "ping", method: "ping" });
  assert.equal(message.status, 202);
  assert.deepEqual(JSON.parse((await events.readEvent()).data).result, {});
});

test("SSE transport rejects invalid origins and malformed message requests", async (t) => {
  const service = await startService(t);
  await expectOAuthError(await fetch(`${service.origin}/sse`, { headers: { origin: "https://evil.test" } }), 403, "forbidden");
  await expectOAuthError(
    await fetch(`${service.origin}/sse`, { headers: { accept: "application/json", origin: "https://chatgpt.com" } }),
    400,
    "bad_request",
  );
  await expectOAuthError(await postMessage(service.origin, "/messages", { jsonrpc: "2.0", id: "missing-session", method: "ping" }), 400, "bad_request");
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(`${service.origin}/sse`, {
    signal: controller.signal,
    headers: { accept: "text/event-stream", origin: "https://chatgpt.com" },
  });
  assert.ok(stream.body);
  const events = new SseReader(stream.body.getReader());
  const endpoint = (await events.readEvent()).data;
  await expectOAuthError(await postMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "type", method: "ping" }, "text/plain"), 415, "bad_request");
  await expectOAuthError(
    await postMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "type-suffix", method: "ping" }, "application/json-seq"),
    415,
    "bad_request",
  );
  await expectOAuthError(
    await postMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "bad-charset", method: "ping" }, "application/json; charset=iso-8859-1"),
    415,
    "bad_request",
  );
  const charsetMessage = await postMessage(
    service.origin,
    endpoint,
    { jsonrpc: "2.0", id: "charset", method: "ping" },
    "application/json; charset=utf-8",
  );
  assert.equal(charsetMessage.status, 202);
  assert.deepEqual(JSON.parse((await events.readEvent()).data).result, {});
  const malformed = await fetch(`${service.origin}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://chatgpt.com" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal(requireRecord((await readJson(malformed)).error, "json-rpc error").code, -32700);
  const oversized = await postMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "oversized", method: "ping", params: { payload: "x".repeat(33000) } });
  assert.equal(oversized.status, 413);
  assert.equal(requireRecord((await readJson(oversized)).error, "json-rpc error").code, -32600);
  const missing = await postMessage(service.origin, endpoint, { jsonrpc: "2.0", id: "missing", method: "missing/method" });
  assert.equal(missing.status, 202);
  assert.equal(requireRecord(JSON.parse((await events.readEvent()).data).error, "json-rpc error").code, -32601);
});

async function postMessage(origin: string, endpoint: string, body: Record<string, unknown>, contentType = "application/json"): Promise<Response> {
  return fetch(`${origin}${endpoint}`, {
    method: "POST",
    headers: { "content-type": contentType, origin: "https://chatgpt.com" },
    body: JSON.stringify(body),
  });
}

import assert from "node:assert/strict";
import test from "node:test";
import { expectOAuthError, readJson, requireRecord } from "../support/http.ts";
import { startService } from "../support/service-process.ts";

test("SSE transport announces the messages endpoint and accepts JSON-RPC messages", async (t) => {
  const service = await startService(t);
  const stream = await fetch(`${service.origin}/sse`, {
    headers: { accept: "text/event-stream", origin: "https://chatgpt.com" },
  });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get("content-type") ?? "", /text\/event-stream/);
  const text = await stream.text();
  assert.match(text, /event: endpoint/);
  assert.match(text, /"endpoint":"\/messages"/);
  const message = await postMessage(service.origin, { jsonrpc: "2.0", id: "ping", method: "ping" });
  assert.equal(message.status, 200);
  assert.deepEqual((await readJson(message)).result, {});
  const protectedMessage = await postMessage(service.origin, { jsonrpc: "2.0", id: "identity.profile", method: "tools/call", params: { name: "identity.profile", arguments: {} } });
  assert.equal(protectedMessage.status, 200);
  assert.match(protectedMessage.headers.get("www-authenticate") ?? "", /resource_metadata=/);
  assert.equal(requireRecord((await readJson(protectedMessage)).result, "protected result").isError, true);
});

test("SSE transport rejects invalid origins and malformed message requests", async (t) => {
  const service = await startService(t);
  await expectOAuthError(await fetch(`${service.origin}/sse`, { headers: { origin: "https://evil.test" } }), 403, "forbidden");
  await expectOAuthError(
    await fetch(`${service.origin}/sse`, { headers: { accept: "application/json", origin: "https://chatgpt.com" } }),
    400,
    "bad_request",
  );
  await expectOAuthError(await postMessage(service.origin, { jsonrpc: "2.0", id: "type", method: "ping" }, "text/plain"), 415, "bad_request");
  await expectOAuthError(
    await postMessage(service.origin, { jsonrpc: "2.0", id: "type-suffix", method: "ping" }, "application/json-seq"),
    415,
    "bad_request",
  );
  const charsetMessage = await postMessage(
    service.origin,
    { jsonrpc: "2.0", id: "charset", method: "ping" },
    "application/json; charset=utf-8",
  );
  assert.equal(charsetMessage.status, 200);
  assert.deepEqual((await readJson(charsetMessage)).result, {});
  const malformed = await fetch(`${service.origin}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://chatgpt.com" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal(requireRecord((await readJson(malformed)).error, "json-rpc error").code, -32700);
  const oversized = await postMessage(service.origin, { jsonrpc: "2.0", id: "oversized", method: "ping", params: { payload: "x".repeat(33000) } });
  assert.equal(oversized.status, 413);
  assert.equal(requireRecord((await readJson(oversized)).error, "json-rpc error").code, -32600);
  const missing = await postMessage(service.origin, { jsonrpc: "2.0", id: "missing", method: "missing/method" });
  assert.equal(missing.status, 200);
  assert.equal(requireRecord((await readJson(missing)).error, "json-rpc error").code, -32601);
});

async function postMessage(origin: string, body: Record<string, unknown>, contentType = "application/json"): Promise<Response> {
  return fetch(`${origin}/messages`, {
    method: "POST",
    headers: { "content-type": contentType, origin: "https://chatgpt.com" },
    body: JSON.stringify(body),
  });
}

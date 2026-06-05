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
});

test("SSE transport rejects invalid origins and malformed message requests", async (t) => {
  const service = await startService(t);
  await expectOAuthError(await fetch(`${service.origin}/sse`, { headers: { origin: "https://evil.test" } }), 403, "forbidden");
  await expectOAuthError(await postMessage(service.origin, { jsonrpc: "2.0", id: "type", method: "ping" }, "text/plain"), 415, "bad_request");
  const malformed = await fetch(`${service.origin}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://chatgpt.com" },
    body: "{",
  });
  await expectOAuthError(malformed, 400, "bad_request");
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

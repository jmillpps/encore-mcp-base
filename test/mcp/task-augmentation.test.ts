import assert from "node:assert/strict";
import test from "node:test";
import { readJson, requireRecord } from "../support/http.ts";
import { initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

test("MCP tools ignore undeclared task augmentation while preserving auth", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const health = await postMcp(service, taskToolCall("health.check"), { sessionId });
  assert.equal(health.status, 200);
  const healthResult = requireRecord((await readJson(health)).result, "health result");
  const structuredContent = requireRecord(healthResult.structuredContent, "health structuredContent");
  assert.equal(structuredContent.status, "ok");
  assert.equal(Object.hasOwn(healthResult, "task"), false);
  const profile = await postMcp(service, taskToolCall("identity.profile"), { sessionId });
  assert.equal(profile.status, 200);
  assert.match(profile.headers.get("www-authenticate") ?? "", /invalid_token/);
  const profileResult = requireRecord((await readJson(profile)).result, "profile result");
  assert.equal(profileResult.isError, true);
  const meta = requireRecord(profileResult._meta, "profile metadata");
  assert.ok(Array.isArray(meta["mcp/www_authenticate"]));
});

function taskToolCall(name: string): Record<string, unknown> {
  return { jsonrpc: "2.0", id: name, method: "tools/call", params: { name, arguments: {}, task: { ttl: 60000 } } };
}

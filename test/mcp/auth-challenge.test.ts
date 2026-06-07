import assert from "node:assert/strict";
import test from "node:test";
import { readJson, requireRecord } from "../support/http.ts";
import { initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

test("MCP protected tools return ChatGPT-compatible auth challenges in metadata and HTTP headers", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const response = await postMcp(service, { jsonrpc: "2.0", id: "profile", method: "tools/call", params: { name: "identity.profile", arguments: {} } }, { sessionId });
  assert.equal(response.status, 200);
  const header = response.headers.get("www-authenticate") ?? "";
  assert.match(header, /Bearer/);
  assert.match(header, new RegExp(`resource_metadata="${service.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/\\.well-known\\/oauth-protected-resource\\/mcp"`));
  assert.match(header, /scope="openid profile email"/);
  const result = requireRecord((await readJson(response)).result, "tool result");
  assert.equal(result.isError, true);
  const meta = requireRecord(result._meta, "tool metadata");
  const challenges = meta["mcp/www_authenticate"];
  assert.ok(Array.isArray(challenges));
  assert.equal(challenges[0], header);
});

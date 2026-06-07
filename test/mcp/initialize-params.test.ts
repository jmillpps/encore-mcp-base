import assert from "node:assert/strict";
import test from "node:test";
import { readJson, requireString } from "../support/http.ts";
import { postMcp } from "../support/mcp.ts";
import { startService, type TestService } from "../support/service-process.ts";

test("MCP initialize validates request params and schema-owned metadata", async (t) => {
  const service = await startService(t);
  const valid = await postMcp(service, {
    jsonrpc: "2.0",
    id: "valid-init",
    method: "initialize",
    params: initializeParams({
      _meta: { progressToken: "init-progress", trace: { id: "abc" } },
      capabilities: { "com.example.custom": { enabled: true }, roots: { listChanged: true } },
    }),
  });
  assert.equal(valid.status, 200);
  assert.equal(requireString(valid.headers.get("mcp-session-id"), "mcp-session-id").length > 0, true);
  for (const params of [
    initializeParams({ unsupported: true }),
    initializeParams({ _meta: { progressToken: [] } }),
    initializeParams({ capabilities: { roots: { listChanged: true, extra: true } } }),
    initializeParams({ capabilities: { sampling: { context: {}, extra: {} } } }),
    initializeParams({ capabilities: { tasks: { requests: { sampling: { createMessage: {}, extra: {} } } } } }),
    initializeParams({ clientInfo: { name: "test", version: "0.1.0", hidden: true } }),
    initializeParams({ clientInfo: { name: "test", version: "0.1.0", icons: [{ src: "https://example.test/icon.png", hidden: true }] } }),
  ]) {
    await expectInitializeProtocolError(service, params);
  }
});

test("MCP initialize rejects malformed client capabilities", async (t) => {
  const service = await startService(t);
  for (const capabilities of [
    { roots: "invalid" },
    { roots: { listChanged: "yes" } },
    { sampling: { context: true } },
    { elicitation: { form: [] } },
    { tasks: { requests: { sampling: { createMessage: false } } } },
    { experimental: { custom: false } },
  ]) {
    await expectInitializeProtocolError(service, initializeParams({ capabilities }));
  }
});

async function expectInitializeProtocolError(service: TestService, params: Record<string, unknown>): Promise<void> {
  const response = await postMcp(service, { jsonrpc: "2.0", id: "bad-init", method: "initialize", params });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("mcp-session-id"), null);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, -32602);
}

function initializeParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "test", version: "0.1.0" },
    ...overrides,
  };
}

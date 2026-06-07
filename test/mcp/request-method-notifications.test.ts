import assert from "node:assert/strict";
import test from "node:test";
import { readJson } from "../support/http.ts";
import { initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

test("MCP Streamable HTTP rejects request methods sent as notifications", async (t) => {
  const service = await startService(t);
  await expectInvalidRequestMethodNotification(
    await postMcp(service, {
      jsonrpc: "2.0",
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "0.1.0" } },
    }),
  );
  const sessionId = await initializeMcp(service);
  for (const message of [
    { jsonrpc: "2.0", method: "ping" },
    { jsonrpc: "2.0", method: "tools/list" },
    { jsonrpc: "2.0", method: "tools/call", params: { name: "health.check", arguments: {} } },
  ]) {
    await expectInvalidRequestMethodNotification(await postMcp(service, message, { sessionId }));
  }
  const initialized = await postMcp(service, { jsonrpc: "2.0", method: "notifications/initialized" }, { sessionId });
  assert.equal(initialized.status, 202);
  assert.equal(await initialized.text(), "");
});

async function expectInvalidRequestMethodNotification(response: Response): Promise<void> {
  assert.equal(response.status, 400);
  const body = await readJson(response);
  assert.equal((body.error as Record<string, unknown>).code, -32600);
  assert.equal(Object.hasOwn(body, "id"), false);
}

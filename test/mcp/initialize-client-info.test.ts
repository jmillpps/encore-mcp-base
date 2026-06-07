import assert from "node:assert/strict";
import test from "node:test";
import { readJson } from "../support/http.ts";
import { postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

test("MCP initialize rejects malformed optional client implementation metadata", async (t) => {
  const service = await startService(t);
  for (const clientInfo of [
    { name: "test", version: "0.1.0", title: [] },
    { name: "test", version: "0.1.0", description: 1 },
    { name: "test", version: "0.1.0", websiteUrl: 1 },
    { name: "test", version: "0.1.0", icons: "invalid" },
    { name: "test", version: "0.1.0", icons: [{ src: 1 }] },
    { name: "test", version: "0.1.0", icons: [{ src: "https://example.test/icon.png", mimeType: 1 }] },
    { name: "test", version: "0.1.0", icons: [{ src: "https://example.test/icon.png", sizes: [1] }] },
    { name: "test", version: "0.1.0", icons: [{ src: "https://example.test/icon.png", theme: "solarized" }] },
  ]) {
    const response = await postMcp(service, {
      jsonrpc: "2.0",
      id: "bad-client-info",
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo },
    });
    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal((body.error as Record<string, unknown>).code, -32000);
  }
});

test("MCP initialize accepts valid optional client implementation metadata", async (t) => {
  const service = await startService(t);
  const response = await postMcp(service, {
    jsonrpc: "2.0",
    id: "valid-client-info",
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: {
        name: "test",
        title: "Test Client",
        version: "0.1.0",
        description: "Test MCP client.",
        websiteUrl: "https://example.test",
        icons: [{ src: "https://example.test/icon.png", mimeType: "image/png", sizes: ["48x48"], theme: "light" }],
      },
    },
  });
  assert.equal(response.status, 200);
});

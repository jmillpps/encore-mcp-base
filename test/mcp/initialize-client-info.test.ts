import assert from "node:assert/strict";
import test from "node:test";
import { readJson, requireRecord, requireString } from "../support/http.ts";
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
    { name: "test", version: "0.1.0", icons: [{ src: "data:image/png,not-base64" }] },
    { name: "test", version: "0.1.0", icons: [{ src: "data:image/png;base64,not-base64!" }] },
    { name: "test", version: "0.1.0", icons: [{ src: "data:text/html;base64,PGgxPkJhZDwvaDE+" }] },
    { name: "test", version: "0.1.0", icons: [{ src: "https://example.test/icon.png", mimeType: 1 }] },
    { name: "test", version: "0.1.0", icons: [{ src: "https://example.test/icon.png", mimeType: "text/html" }] },
    { name: "test", version: "0.1.0", icons: [{ src: "https://example.test/icon.png", sizes: [1] }] },
    { name: "test", version: "0.1.0", icons: [{ src: "https://example.test/icon.png", sizes: ["48 by 48"] }] },
    { name: "test", version: "0.1.0", icons: [{ src: "https://example.test/icon.png", theme: "solarized" }] },
  ]) {
    const response = await postMcp(service, {
      jsonrpc: "2.0",
      id: "bad-client-info",
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo },
    });
    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal((body.error as Record<string, unknown>).code, -32602);
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
        icons: [
          { src: "https://example.test/icon.png", mimeType: "image/png", sizes: ["48x48"], theme: "light" },
          { src: "data:image/png;base64,AQID", mimeType: "image/png", sizes: ["any"], theme: "dark" },
        ],
      },
    },
  });
  assert.equal(response.status, 200);
});

test("MCP initialize exposes server implementation metadata", async (t) => {
  const service = await startService(t);
  const response = await postMcp(service, {
    jsonrpc: "2.0",
    id: "server-info",
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "test", version: "0.1.0" },
    },
  });
  assert.equal(response.status, 200);
  const result = requireRecord((await readJson(response)).result, "initialize result");
  const serverInfo = requireRecord(result.serverInfo, "serverInfo");
  assert.equal(requireString(serverInfo.name, "serverInfo.name"), "gpt-mcp-service");
  assert.equal(requireString(serverInfo.title, "serverInfo.title"), "GPT MCP Service");
  assert.equal(requireString(serverInfo.description, "serverInfo.description").length > 0, true);
  assert.equal(requireString(serverInfo.websiteUrl, "serverInfo.websiteUrl"), service.origin);
  assert.equal(Array.isArray(serverInfo.icons), true);
  const icons = serverInfo.icons as unknown[];
  assert.equal(icons.length, 1);
  const icon = requireRecord(icons[0], "serverInfo.icons[0]");
  assert.match(requireString(icon.src, "serverInfo.icons[0].src"), /^data:image\/svg\+xml;base64,/);
  assert.equal(requireString(icon.mimeType, "serverInfo.icons[0].mimeType"), "image/svg+xml");
  assert.deepEqual(icon.sizes, ["any"]);
});

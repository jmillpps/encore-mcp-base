import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ServiceConfig } from "../../shared/config.ts";
import { ServiceError } from "../../shared/errors.ts";
import { callTool, tools, type McpTool } from "../../mcp/tool-registry.ts";
import { emptyInputSchema, objectSchema, stringSchema } from "../../mcp/tool-schemas.ts";

test("callTool rejects successful results that violate the tool output schema", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-output-validation-"));
  const tool: McpTool = {
    name: "test.invalid-output",
    title: "Invalid Output",
    description: "Return invalid output for validator testing.",
    inputSchema: emptyInputSchema(),
    outputSchema: objectSchema({ status: stringSchema() }),
    annotations: { readOnlyHint: true },
    requiredScopes: [],
    run: async () => ({ content: [{ type: "text", text: "bad" }], structuredContent: { status: 1 } }),
  };
  tools.push(tool);
  try {
    await assert.rejects(
      () => callTool({ config: testConfig(join(dir, "store.json")), rateLimitSubject: "output-validation" }, tool.name, {}),
      (error) => error instanceof ServiceError && error.code === "server_error" && error.status === 500 && error.message === "invalid tool output",
    );
  } finally {
    tools.splice(tools.indexOf(tool), 1);
    await rm(dir, { recursive: true, force: true });
  }
});

function testConfig(oauthStorePath: string): ServiceConfig {
  return {
    issuer: "http://localhost:4000",
    mcpResource: "http://localhost:4000/mcp",
    actionsAudience: "http://localhost:4000/actions",
    oauthStorePath,
    allowedOrigins: ["https://chatgpt.com"],
    accessTokenTtlSeconds: 900,
    idTokenTtlSeconds: 300,
    authorizationCodeTtlSeconds: 300,
    refreshTokenTtlSeconds: 2592000,
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 120,
    mcpSseMaxConnections: 1024,
    production: false,
  };
}

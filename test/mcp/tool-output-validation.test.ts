import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ServiceConfig } from "../../shared/config.ts";
import { ServiceError } from "../../shared/errors.ts";
import { readOnlyToolAnnotations } from "../../mcp/tool-annotations.ts";
import { callTool, tools, type McpTool } from "../../mcp/tool-registry.ts";
import { emptyInputSchema, objectSchema, stringSchema } from "../../mcp/tool-schemas.ts";

const testInvocation = { invoking: "Running test tool", invoked: "Test tool ready" };

test("callTool rejects successful results that violate the tool output schema", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-output-validation-"));
  const tool: McpTool = {
    name: "test.invalid-output",
    title: "Invalid Output",
    description: "Return invalid output for validator testing.",
    inputSchema: emptyInputSchema(),
    outputSchema: objectSchema("Test output.", { status: stringSchema("Test status.") }),
    annotations: readOnlyToolAnnotations(),
    invocation: testInvocation,
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

test("callTool rejects malformed tool result envelopes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-result-validation-"));
  for (const [index, result] of [
    { content: "bad", structuredContent: { status: "ok" } },
    { content: [{ type: "text", text: 1 }], structuredContent: { status: "ok" } },
    { content: [{ type: "text", text: "ok", secret: "leak" }], structuredContent: { status: "ok" } },
    { content: [{ type: "text", text: "ok", annotations: { audience: ["system"] } }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource_link", name: "resource", uri: "https://example.test/resource", secret: "leak" }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource_link", name: "resource", uri: "not a uri" }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource_link", name: "resource", uri: "javascript:alert(1)" }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource_link", name: "resource", uri: "file:///etc/passwd" }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource_link", name: "resource", uri: "ftp://example.test/resource" }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource_link", name: "resource", uri: "https://example.test/resource", icons: [{ src: "javascript:alert(1)" }] }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource_link", name: "resource", uri: "https://example.test/resource", icons: [{ src: "data:image/png;base64,AQID", sizes: ["48 by 48"] }] }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource", resource: { uri: "https://example.test/resource", text: "ok", blob: "b2s=" } }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource", resource: { uri: "not a uri", text: "ok" } }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource", resource: { uri: "data:text/plain;base64,b2s=", text: "ok" } }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource", resource: { uri: "mailto:user@example.test", text: "ok" } }], structuredContent: { status: "ok" } },
    { content: [{ type: "resource", resource: { uri: "https://example.test/resource", blob: "not base64!" } }], structuredContent: { status: "ok" } },
    { content: [{ type: "image", data: "not base64!", mimeType: "image/png" }], structuredContent: { status: "ok" } },
    { content: [{ type: "image", data: "AQID", mimeType: "text/html" }], structuredContent: { status: "ok" } },
    { content: [{ type: "audio", data: "AQID", mimeType: "image/png" }], structuredContent: { status: "ok" } },
    { content: [{ type: "text", text: "ok" }], structuredContent: [], isError: false },
    { content: [{ type: "text", text: "ok" }], structuredContent: { status: "ok" }, isError: "false" },
    { content: [{ type: "text", text: "ok" }], structuredContent: { status: "ok" }, _meta: [] },
  ].entries()) {
    const tool: McpTool = {
      name: `test.invalid-result-${index}`,
      title: "Invalid Result",
      description: "Return invalid result envelope for validator testing.",
      inputSchema: emptyInputSchema(),
      outputSchema: objectSchema("Test output.", { status: stringSchema("Test status.") }),
      annotations: readOnlyToolAnnotations(),
      invocation: testInvocation,
      requiredScopes: [],
      run: async () => result,
    };
    tools.push(tool);
    try {
      await assert.rejects(
        () => callTool({ config: testConfig(join(dir, "store.json")), rateLimitSubject: `result-validation-${index}` }, tool.name, {}),
        (error) => error instanceof ServiceError && error.code === "server_error" && error.status === 500 && error.message === "invalid tool result",
      );
    } finally {
      tools.splice(tools.indexOf(tool), 1);
    }
  }
  await rm(dir, { recursive: true, force: true });
});

test("callTool accepts valid text content metadata", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-content-validation-"));
  const tool: McpTool = {
    name: "test.valid-content-metadata",
    title: "Valid Content Metadata",
    description: "Return content metadata for validator testing.",
    inputSchema: emptyInputSchema(),
    outputSchema: objectSchema("Test output.", { status: stringSchema("Test status.") }),
    annotations: readOnlyToolAnnotations(),
    invocation: testInvocation,
    requiredScopes: [],
    run: async () => ({
      content: [
        {
          type: "text",
          text: "ok",
          annotations: { audience: ["user", "assistant"], priority: 0.5, lastModified: "2026-06-07T00:00:00Z" },
          _meta: { trace: "valid" },
        },
      ],
      structuredContent: { status: "ok" },
    }),
  };
  tools.push(tool);
  try {
    const result = await callTool({ config: testConfig(join(dir, "store.json")), rateLimitSubject: "content-validation" }, tool.name, {});
    assert.equal((result.structuredContent as Record<string, unknown>).status, "ok");
  } finally {
    tools.splice(tools.indexOf(tool), 1);
    await rm(dir, { recursive: true, force: true });
  }
});

test("callTool accepts valid binary and resource content", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-binary-content-validation-"));
  const tool: McpTool = {
    name: "test.valid-binary-resource-content",
    title: "Valid Binary Resource Content",
    description: "Return binary and resource content for validator testing.",
    inputSchema: emptyInputSchema(),
    outputSchema: objectSchema("Test output.", { status: stringSchema("Test status.") }),
    annotations: readOnlyToolAnnotations(),
    invocation: testInvocation,
    requiredScopes: [],
    run: async () => ({
      content: [
        { type: "image", data: "AQID", mimeType: "image/png" },
        { type: "audio", data: "AQID", mimeType: "audio/mpeg" },
        {
          type: "resource_link",
          name: "resource",
          uri: "https://example.test/resource",
          icons: [{ src: "data:image/png;base64,AQID", mimeType: "image/png", sizes: ["48x48", "any"], theme: "light" }],
          size: 3,
        },
        { type: "resource", resource: { uri: "ui://widget/data", mimeType: "application/octet-stream", blob: "AQID" } },
      ],
      structuredContent: { status: "ok" },
    }),
  };
  tools.push(tool);
  try {
    const result = await callTool({ config: testConfig(join(dir, "store.json")), rateLimitSubject: "binary-content-validation" }, tool.name, {});
    assert.equal((result.structuredContent as Record<string, unknown>).status, "ok");
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
    upstreamOidc: {
      issuer: "http://127.0.0.1:4100",
      authorizationUrl: "http://127.0.0.1:4100/oauth2/authorize",
      tokenUrl: "http://127.0.0.1:4100/oauth2/token",
      userinfoUrl: "http://127.0.0.1:4100/oauth2/userInfo",
      clientId: "upstream-client",
      clientSecret: "upstream-secret",
      redirectUri: "http://localhost:4000/oauth/callback",
      scopes: ["openid", "profile", "email"],
      tokenEndpointAuthMethod: "client_secret_post",
    },
    production: false,
  };
}

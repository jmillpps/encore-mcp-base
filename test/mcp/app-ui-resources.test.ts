import assert from "node:assert/strict";
import test from "node:test";
import { completeAuthorizationCodeFlow } from "../support/oauth-client.ts";
import { bearer, callTool, initializeMcp, mcpAuthorization, postMcp } from "../support/mcp.ts";
import { assertExposesHeader, readJson, requireRecord, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";
import { testUserProfile } from "../support/user-profile.ts";
import { appHtmlResource, toolUiResource } from "../../mcp/app-ui.ts";
import { listResources, readResource, resources } from "../../mcp/resource-registry.ts";
import { appUiResourceMimeType, type McpResourceDefinition } from "../../mcp/resource-types.ts";
import { listTools, tools, type McpTool } from "../../mcp/tool-registry.ts";
import { readOnlyToolAnnotations } from "../../mcp/tool-annotations.ts";
import { emptyInputSchema, objectSchema, stringSchema } from "../../mcp/tool-schemas.ts";
import { readConfig } from "../../shared/config.ts";
import { ServiceError } from "../../shared/errors.ts";
import { healthStatusCardScriptPath, healthStatusCardStylePath, healthStatusCardUri, profileSummaryCardScriptPath, profileSummaryCardStylePath, profileSummaryCardUri, widgetAssets } from "../../mcp/widgets/index.ts";

test("MCP Apps UI resources expose capabilities, descriptors, contents, and render tool metadata", async (t) => {
  const service = await startService(t);
  const authorization = await mcpAuthorization(service);
  const init = await postMcp(service, {
    jsonrpc: "2.0",
    id: "init",
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "ui-resource-test", version: "0.1.0" } },
  }, { authorization });
  assert.equal(init.status, 200);
  const sessionId = requireString(init.headers.get("mcp-session-id"), "mcp-session-id");
  const initResult = requireRecord((await readJson(init)).result, "initialize result");
  assert.deepEqual(requireRecord(initResult.capabilities, "capabilities").resources, {});
  const initialized = await postMcp(service, { jsonrpc: "2.0", method: "notifications/initialized" }, { sessionId, authorization });
  assert.equal(initialized.status, 202);

  const listedTools = await postMcp(service, { jsonrpc: "2.0", id: "tools", method: "tools/list" }, { sessionId, authorization });
  const toolList = requireRecord((await readJson(listedTools)).result, "tools result").tools as Record<string, unknown>[];
  assertToolTemplate(toolByName(toolList, "health.status_card"), healthStatusCardUri, [{ type: "noauth" }]);
  assertToolTemplate(toolByName(toolList, "identity.profile_card"), profileSummaryCardUri, [{ type: "oauth2", scopes: ["openid", "profile", "email"] }]);

  const listedResources = await postMcp(service, { jsonrpc: "2.0", id: "resources", method: "resources/list", params: { _meta: { progressToken: "resources" } } }, { sessionId, authorization });
  assert.equal(listedResources.status, 200);
  const resourceList = requireRecord((await readJson(listedResources)).result, "resources result").resources as Record<string, unknown>[];
  assertResourceDescriptor(resourceByUri(resourceList, healthStatusCardUri), "health-status-card");
  assertResourceDescriptor(resourceByUri(resourceList, profileSummaryCardUri), "profile-summary-card");

  const templates = await postMcp(service, { jsonrpc: "2.0", id: "templates", method: "resources/templates/list" }, { sessionId, authorization });
  assert.deepEqual(requireRecord((await readJson(templates)).result, "templates result").resourceTemplates, []);

  const readHealth = await postMcp(service, { jsonrpc: "2.0", id: "read-health", method: "resources/read", params: { uri: healthStatusCardUri } }, { sessionId, authorization });
  const healthContent = firstContent(await readJson(readHealth));
  assert.equal(healthContent.uri, healthStatusCardUri);
  assert.equal(healthContent.mimeType, appUiResourceMimeType);
  const healthHtml = requireString(healthContent.text, "health card html");
  assert.match(healthHtml, /Health status/);
  assertCspSafeHtml(healthHtml, healthStatusCardStylePath, healthStatusCardScriptPath);
  assertResourceMeta(requireRecord(healthContent._meta, "health card metadata"), service.origin);

  const healthTool = await callTool(service, sessionId, "health.status_card", authorization);
  assert.equal((requireRecord(healthTool.structuredContent, "health status card output")).status, "ok");
});

test("MCP protected UI resources enforce OAuth scopes on resource reads and tool calls", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const narrowFlow = await completeAuthorizationCodeFlow(service, service.mcpResource, "openid");
  const missingScope = await postMcp(service, {
    jsonrpc: "2.0",
    id: "profile-resource-missing-scope",
    method: "resources/read",
    params: { uri: profileSummaryCardUri },
  }, { sessionId, authorization: bearer(narrowFlow.tokens.access_token) });
  assert.equal(missingScope.status, 200);
  assertExposesHeader(missingScope, "www-authenticate");
  assert.match(missingScope.headers.get("www-authenticate") ?? "", /error="insufficient_scope"/);
  assert.match(missingScope.headers.get("www-authenticate") ?? "", /scope="openid profile email"/);
  const error = requireRecord((await readJson(missingScope)).error, "resource auth error");
  assert.equal(error.code, -32000);

  const missingToolScope = await postMcp(service, {
    jsonrpc: "2.0",
    id: "profile-card-missing-scope",
    method: "tools/call",
    params: { name: "identity.profile_card", arguments: {} },
  }, { sessionId, authorization: bearer(narrowFlow.tokens.access_token) });
  assert.equal(missingToolScope.status, 200);
  assert.match(missingToolScope.headers.get("www-authenticate") ?? "", /error="insufficient_scope"/);

  const validFlow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const readProfile = await postMcp(service, {
    jsonrpc: "2.0",
    id: "profile-resource-valid",
    method: "resources/read",
    params: { uri: profileSummaryCardUri },
  }, { sessionId, authorization: bearer(validFlow.tokens.access_token) });
  const profileContent = firstContent(await readJson(readProfile));
  assert.equal(profileContent.uri, profileSummaryCardUri);
  assert.equal(profileContent.mimeType, appUiResourceMimeType);
  const profileHtml = requireString(profileContent.text, "profile card html");
  assert.match(profileHtml, /Authenticated user/);
  assertCspSafeHtml(profileHtml, profileSummaryCardStylePath, profileSummaryCardScriptPath);
  assertResourceMeta(requireRecord(profileContent._meta, "profile card metadata"), service.origin);

  const profileCard = await callTool(service, sessionId, "identity.profile_card", bearer(validFlow.tokens.access_token));
  assert.equal(requireRecord(profileCard.structuredContent, "profile card output").email, testUserProfile.email);
});

test("MCP Apps UI assets are public, versioned, and CSP-addressable", async (t) => {
  const service = await startService(t);
  assert.equal(widgetAssets.length, 4);
  await assertAsset(service.origin, healthStatusCardStylePath, "text/css", /Health status|\.status/);
  await assertAsset(service.origin, healthStatusCardScriptPath, "application/javascript", /ui\/notifications\/tool-result/);
  await assertAsset(service.origin, profileSummaryCardStylePath, "text/css", /Authenticated user|\.avatar/);
  await assertAsset(service.origin, profileSummaryCardScriptPath, "application/javascript", /preferred_username/);
});

test("MCP resource methods reject invalid params, cursors, and missing resources", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  await assertRpcError(await postMcp(service, { jsonrpc: "2.0", id: "bad-resource-uri", method: "resources/read", params: { uri: "javascript:alert(1)" } }, { sessionId }), -32602);
  await assertRpcError(await postMcp(service, { jsonrpc: "2.0", id: "missing-resource", method: "resources/read", params: { uri: "ui://widget/missing.html" } }, { sessionId }), -32002);
  await assertRpcError(await postMcp(service, { jsonrpc: "2.0", id: "bad-resource-cursor", method: "resources/list", params: { cursor: "never-issued" } }, { sessionId }), -32602);
  await assertRpcError(await postMcp(service, { jsonrpc: "2.0", id: "bad-template-cursor", method: "resources/templates/list", params: { cursor: "never-issued" } }, { sessionId }), -32602);
});

test("MCP Apps UI helper validation rejects unsafe metadata, MIME types, and resource contents", async () => {
  assert.throws(() => appHtmlResource({ uri: "javascript:alert(1)", name: "bad", html: "<html></html>" }), ServiceError);
  assert.throws(() => appHtmlResource({ uri: "ui://widget/bad.html", name: "bad", html: "<html></html>", widget: { domain: "https://example.com/path" } }), ServiceError);
  assert.throws(() => appHtmlResource({ uri: "ui://widget/bad.html", name: "bad", html: "<html></html>", widget: { csp: { connectDomains: ["javascript:alert(1)"], resourceDomains: [] } } }), ServiceError);
  assert.throws(() => toolUiResource("javascript:alert(1)"), ServiceError);

  const badMime = { ...baseResource("ui://widget/bad-mime.html"), mimeType: "text/html\nbad" } as McpResourceDefinition;
  resources.push(badMime);
  try {
    assert.throws(() => listResources(), (error) => error instanceof ServiceError && error.message === "invalid resource descriptor");
  } finally {
    resources.splice(resources.indexOf(badMime), 1);
  }

  const badContent = { ...baseResource("ui://widget/bad-content.html"), contents: [{ uri: "ui://widget/bad-content.html", mimeType: appUiResourceMimeType, text: "<html></html>", blob: "AAAA" }] } as McpResourceDefinition;
  resources.push(badContent);
  try {
    await assert.rejects(() => readResource({ config: readConfig(), authorization: "Bearer test", rateLimitSubject: "test" }, badContent.uri), (error) => error instanceof ServiceError && error.message === "invalid resource content");
  } finally {
    resources.splice(resources.indexOf(badContent), 1);
  }

  const badTool = { ...baseTool(), ui: { resourceUri: "javascript:alert(1)" } } as unknown as McpTool;
  tools.push(badTool);
  try {
    assert.throws(() => listTools(), (error) => error instanceof ServiceError && error.message === "invalid tool descriptor");
  } finally {
    tools.splice(tools.indexOf(badTool), 1);
  }
});

function assertToolTemplate(tool: Record<string, unknown>, resourceUri: string, securitySchemes: Record<string, unknown>[]): void {
  const meta = requireRecord(tool._meta, "tool metadata");
  const ui = requireRecord(meta.ui, "tool ui metadata");
  assert.equal(ui.resourceUri, resourceUri);
  assert.deepEqual(ui.visibility, ["model", "app"]);
  assert.equal(meta["openai/outputTemplate"], resourceUri);
  assert.deepEqual(tool.securitySchemes, securitySchemes);
}

function assertResourceDescriptor(resource: Record<string, unknown>, name: string): void {
  assert.equal(resource.name, name);
  assert.equal(resource.mimeType, appUiResourceMimeType);
  assert.equal(typeof resource.title, "string");
  assert.equal(typeof resource.description, "string");
}

function assertResourceMeta(meta: Record<string, unknown>, widgetDomain: string): void {
  const ui = requireRecord(meta.ui, "resource ui metadata");
  assert.equal(ui.prefersBorder, true);
  assert.equal(ui.domain, widgetDomain);
  const csp = requireRecord(ui.csp, "standard csp");
  assert.deepEqual(csp.connectDomains, []);
  assert.deepEqual(csp.resourceDomains, [widgetDomain]);
  assert.equal(meta["openai/widgetPrefersBorder"], true);
  assert.equal(meta["openai/widgetDomain"], widgetDomain);
  const openAiCsp = requireRecord(meta["openai/widgetCSP"], "openai csp");
  assert.deepEqual(openAiCsp.connect_domains, []);
  assert.deepEqual(openAiCsp.resource_domains, [widgetDomain]);
}

function assertCspSafeHtml(html: string, stylePath: string, scriptPath: string): void {
  assert.equal(html.includes("<style"), false);
  assert.equal(html.includes("type=\"module\""), false);
  assert.match(html, new RegExp(`<link rel="stylesheet" href="${escapeRegExp(stylePath)}">`));
  assert.match(html, new RegExp(`<script src="${escapeRegExp(scriptPath)}"></script>`));
}

async function assertAsset(origin: string, path: string, contentType: string, bodyPattern: RegExp): Promise<void> {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", new RegExp(`^${escapeRegExp(contentType)}\\b`));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.match(await response.text(), bodyPattern);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstContent(body: Record<string, unknown>): Record<string, unknown> {
  const contents = requireRecord(body.result, "read result").contents;
  assert.ok(Array.isArray(contents));
  return requireRecord(contents[0], "resource content");
}

async function assertRpcError(response: Response, code: number): Promise<void> {
  assert.equal(response.status, 200);
  assert.equal(requireRecord((await readJson(response)).error, "rpc error").code, code);
}

function toolByName(list: Record<string, unknown>[], name: string): Record<string, unknown> {
  const tool = list.find((candidate) => candidate.name === name);
  assert.ok(tool);
  return tool;
}

function resourceByUri(list: Record<string, unknown>[], uri: string): Record<string, unknown> {
  const resource = list.find((candidate) => candidate.uri === uri);
  assert.ok(resource);
  return resource;
}

function baseResource(uri: string): McpResourceDefinition {
  return {
    uri,
    name: "test-resource",
    title: "Test Resource",
    description: "Test resource descriptor.",
    mimeType: appUiResourceMimeType,
    requiredScopes: [],
    contents: [{ uri, mimeType: appUiResourceMimeType, text: "<html></html>" }],
  };
}

function baseTool(): McpTool {
  return {
    name: "test.ui.bad-tool",
    title: "Bad UI Tool",
    description: "Validate bad UI metadata.",
    inputSchema: emptyInputSchema(),
    outputSchema: objectSchema("Bad UI tool output.", { status: stringSchema("Bad UI tool status.") }),
    annotations: readOnlyToolAnnotations(),
    invocation: { invoking: "Running UI validation", invoked: "UI validation ready" },
    requiredScopes: [],
    run: async () => ({ content: [{ type: "text", text: "{\"status\":\"ok\"}" }], structuredContent: { status: "ok" } }),
  };
}

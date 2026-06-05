import assert from "node:assert/strict";
import test from "node:test";
import { completeAuthorizationCodeFlow } from "../support/oauth-client.ts";
import { callTool, initializeMcp, postMcp, bearer } from "../support/mcp.ts";
import { readJson } from "../support/http.ts";
import { startService } from "../support/service-process.ts";

test("MCP tools expose metadata and protected tools return auth challenges", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const listed = await postMcp(service, { jsonrpc: "2.0", id: "list", method: "tools/list" }, { sessionId });
  assert.equal(listed.status, 200);
  const listBody = await readJson(listed);
  const tools = ((listBody.result as Record<string, unknown>).tools as Record<string, unknown>[]);
  assert.ok(tools.some((tool) => tool.name === "identity.profile" && Array.isArray(tool.securitySchemes)));
  const challengeResponse = await postMcp(service, { jsonrpc: "2.0", id: "identity.profile", method: "tools/call", params: { name: "identity.profile", arguments: {} } }, { sessionId });
  assert.equal(challengeResponse.status, 200);
  assert.match(challengeResponse.headers.get("www-authenticate") ?? "", /resource_metadata=/);
  assert.match(challengeResponse.headers.get("www-authenticate") ?? "", /scope="openid profile email"/);
  const challenge = (await readJson(challengeResponse)).result as Record<string, unknown>;
  assert.equal(challenge.isError, true);
  const meta = challenge._meta as Record<string, unknown>;
  assert.ok(Array.isArray(meta["mcp/www_authenticate"]));
});

test("MCP tools return structured content that matches advertised output schemas", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const health = await callTool(service, sessionId, "health.check");
  const healthContent = health.structuredContent as Record<string, unknown>;
  assert.equal(healthContent.status, "ok");
  assert.equal(typeof healthContent.timestamp, "string");
  const serviceInfo = healthContent.service as Record<string, unknown>;
  assert.equal(serviceInfo.name, "gpt-mcp-service");
  assert.equal(serviceInfo.version, "0.1.0");
  const validFlow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const session = await callTool(service, sessionId, "auth.session", bearer(validFlow.tokens.access_token));
  const sessionContent = session.structuredContent as Record<string, unknown>;
  assert.equal(sessionContent.subject, "user_justin_miller");
  assert.equal(sessionContent.clientId, "local-test");
  assert.ok(Array.isArray(sessionContent.scopes));
});

test("MCP protected tools enforce audience and scopes", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const validFlow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const profile = await callTool(service, sessionId, "identity.profile", bearer(validFlow.tokens.access_token));
  assert.equal((profile.structuredContent as Record<string, unknown>).email, "jmiller@inifnitedevlab.com");
  const actionsFlow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const wrongAudience = await callTool(service, sessionId, "identity.profile", bearer(actionsFlow.tokens.access_token));
  assert.equal(wrongAudience.isError, true);
  const narrowFlow = await completeAuthorizationCodeFlow(service, service.mcpResource, "openid");
  const missingScopes = await callTool(service, sessionId, "identity.profile", bearer(narrowFlow.tokens.access_token));
  assert.equal(missingScopes.isError, true);
});

test("MCP tools reject arguments outside their input schemas", async (t) => {
  const service = await startService(t);
  const sessionId = await initializeMcp(service);
  const response = await postMcp(
    service,
    { jsonrpc: "2.0", id: "bad-args", method: "tools/call", params: { name: "health.check", arguments: { unexpected: true } } },
    { sessionId },
  );
  assert.equal(response.status, 400);
  const body = await readJson(response);
  assert.equal((body.error as Record<string, unknown>).message, "invalid tool arguments");
});

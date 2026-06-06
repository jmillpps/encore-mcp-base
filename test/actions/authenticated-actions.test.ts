import assert from "node:assert/strict";
import test from "node:test";
import { completeAuthorizationCodeFlow } from "../support/oauth-client.ts";
import { readJson } from "../support/http.ts";
import { bearer } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

test("Actions endpoints reject missing tokens and accept scoped Actions tokens", async (t) => {
  const service = await startService(t);
  const missingToken = await fetch(`${service.origin}/actions/profile`);
  assert.equal(missingToken.status, 401);
  const missingTokenError = await readJson(missingToken);
  assert.equal(missingTokenError.code, "unauthenticated");
  assert.equal(missingTokenError.internal_message, null);
  const flow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const profile = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(profile.status, 200);
  assert.equal((await readJson(profile)).email, "jmiller@inifnitedevlab.com");
  const lowerCaseProfile = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: `bearer ${flow.tokens.access_token}` } });
  assert.equal(lowerCaseProfile.status, 200);
  assert.equal((await readJson(lowerCaseProfile)).email, "jmiller@inifnitedevlab.com");
  const session = await fetch(`${service.origin}/actions/session`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(session.status, 200);
  assert.equal((await readJson(session)).audience, service.actionsAudience);
});

test("Actions endpoints reject MCP audience tokens", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const response = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(response.status, 401);
});

test("Actions profile requires profile and email scopes", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service, service.actionsAudience, "openid");
  const profile = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(profile.status, 403);
  const profileError = await readJson(profile);
  assert.equal(profileError.code, "permission_denied");
  assert.equal(profileError.internal_message, null);
  const session = await fetch(`${service.origin}/actions/session`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(session.status, 200);
  assert.deepEqual((await readJson(session)).scopes, ["openid"]);
});

import assert from "node:assert/strict";
import test from "node:test";
import { requireString } from "../support/http.ts";
import { completeAuthorizationCodeFlow } from "../support/oauth-client.ts";
import { contentLength, hostHeader, rawHttpRequest } from "../support/raw-http.ts";
import { startService } from "../support/service-process.ts";

test("public auth endpoints reject duplicate Authorization headers", async (t) => {
  const service = await startService(t);
  const mcpFlow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const mcpToken = requireString(mcpFlow.tokens.access_token, "mcp access token");
  const mcpBody = JSON.stringify({
    jsonrpc: "2.0",
    id: "duplicate-auth",
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "duplicate-auth-test", version: "0.1.0" } },
  });
  const mcpResponse = await rawHttpRequest(service.origin, [
    "POST /mcp HTTP/1.1",
    `Host: ${hostHeader(service.origin)}`,
    "Connection: close",
    "Accept: application/json, text/event-stream",
    "Content-Type: application/json",
    "Origin: https://chatgpt.com",
    `Authorization: Bearer ${mcpToken}`,
    "Authorization: Bearer attacker-token",
    `Content-Length: ${contentLength(mcpBody)}`,
  ], mcpBody);
  assert.equal(mcpResponse.status, 400);

  const userinfoFlow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const userinfoToken = requireString(userinfoFlow.tokens.access_token, "userinfo access token");
  const userinfoResponse = await rawHttpRequest(service.origin, [
    "GET /oauth/userinfo HTTP/1.1",
    `Host: ${hostHeader(service.origin)}`,
    "Connection: close",
    `Authorization: Bearer ${userinfoToken}`,
    "Authorization: Bearer attacker-token",
  ]);
  assert.equal(userinfoResponse.status, 400);

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code: "unused-code",
    redirect_uri: "http://localhost:4000/test/callback",
  }).toString();
  const tokenResponse = await rawHttpRequest(service.origin, [
    "POST /oauth/token HTTP/1.1",
    `Host: ${hostHeader(service.origin)}`,
    "Connection: close",
    "Content-Type: application/x-www-form-urlencoded",
    "Authorization: Basic bG9jYWwtdGVzdDpsb2NhbC10ZXN0LXNlY3JldA==",
    "Authorization: Basic attacker",
    `Content-Length: ${contentLength(tokenBody)}`,
  ], tokenBody);
  assert.equal(tokenResponse.status, 400);

  const actionsResponse = await rawHttpRequest(service.origin, [
    "GET /actions/profile HTTP/1.1",
    `Host: ${hostHeader(service.origin)}`,
    "Connection: close",
    `Authorization: Bearer ${userinfoToken}`,
    "Authorization: Bearer attacker-token",
  ]);
  assert.equal(actionsResponse.status, 400);
});

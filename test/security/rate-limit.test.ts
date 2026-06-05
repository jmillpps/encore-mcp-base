import assert from "node:assert/strict";
import test from "node:test";
import { expectOAuthError, readJson, requireRecord } from "../support/http.ts";
import { initializeMcp, postMcp } from "../support/mcp.ts";
import { startService } from "../support/service-process.ts";

test("live public endpoints enforce configured rate limits", async (t) => {
  const service = await startService(t, { RATE_LIMIT_MAX_REQUESTS: "1", RATE_LIMIT_WINDOW_SECONDS: "60" });
  const firstAuthorize = await fetch(authorizeUrl(service.origin), { redirect: "manual" });
  assert.equal(firstAuthorize.status, 302);
  await expectOAuthError(await fetch(authorizeUrl(service.origin, "state-2"), { redirect: "manual" }), 429, "rate_limited");
  await expectOAuthError(await tokenRequest(service.origin), 401, "invalid_client");
  await expectOAuthError(await tokenRequest(service.origin), 429, "rate_limited");
  await expectOAuthError(await fetch(`${service.origin}/oauth/userinfo`), 401, "unauthorized");
  await expectOAuthError(await fetch(`${service.origin}/oauth/userinfo`), 429, "rate_limited");
  const sessionId = await initializeMcp(service);
  const firstTool = await postMcp(service, { jsonrpc: "2.0", id: "one", method: "tools/call", params: { name: "health.check", arguments: {} } }, { sessionId });
  assert.equal(firstTool.status, 200);
  const limitedTool = await postMcp(service, { jsonrpc: "2.0", id: "two", method: "tools/call", params: { name: "health.check", arguments: {} } }, { sessionId });
  assert.equal(limitedTool.status, 429);
  assert.equal(requireRecord((await readJson(limitedTool)).error, "json-rpc error").message, "rate limit exceeded");
});

function authorizeUrl(origin: string, state = "state-1"): URL {
  const url = new URL(`${origin}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", "local-test");
  url.searchParams.set("redirect_uri", "http://localhost:4000/test/callback");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("resource", `${origin}/actions`);
  return url;
}

function tokenRequest(origin: string): Promise<Response> {
  return fetch(`${origin}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: "local-test",
      client_secret: "bad-secret",
      code: "bad-code",
      redirect_uri: "http://localhost:4000/test/callback",
    }),
  });
}

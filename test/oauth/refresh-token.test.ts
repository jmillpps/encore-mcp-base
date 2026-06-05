import assert from "node:assert/strict";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, discover, localClient, refreshTokens } from "../support/oauth-client.ts";
import { expectOAuthError, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";

test("refresh token rotation revokes the token family on reuse", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  const firstRefreshToken = requireString(flow.tokens.refresh_token, "refresh_token");
  const rotated = await refreshTokens(flow.as, firstRefreshToken);
  const secondRefreshToken = requireString(rotated.tokens.refresh_token, "refresh_token");
  assert.notEqual(secondRefreshToken, firstRefreshToken);
  const replay = await oauth.refreshTokenGrantRequest(flow.as, localClient, oauth.ClientSecretPost("local-test-secret"), firstRefreshToken, {
    [oauth.allowInsecureRequests]: true,
  });
  await expectOAuthError(replay, 400, "invalid_grant");
  const revokedFamilyToken = await oauth.refreshTokenGrantRequest(flow.as, localClient, oauth.ClientSecretPost("local-test-secret"), secondRefreshToken, {
    [oauth.allowInsecureRequests]: true,
  });
  await expectOAuthError(revokedFamilyToken, 400, "invalid_grant");
});

test("refresh token client mismatch does not rotate the legitimate token", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  const flow = await completeAuthorizationCodeFlow(service);
  const refreshToken = requireString(flow.tokens.refresh_token, "refresh_token");
  const mismatch = await fetch(as.token_endpoint as string, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: "gpt-actions",
      client_secret: "gpt-actions-secret",
      refresh_token: refreshToken,
    }),
  });
  await expectOAuthError(mismatch, 400, "invalid_grant");
  assert.equal((await refreshTokens(flow.as, refreshToken)).tokens.token_type, "bearer");
});

test("refresh token grant rejects arbitrary invalid tokens", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  const response = await oauth.refreshTokenGrantRequest(as, localClient, oauth.ClientSecretPost("local-test-secret"), "not-a-valid-refresh-token", {
    [oauth.allowInsecureRequests]: true,
  });
  await expectOAuthError(response, 400, "invalid_grant");
});

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, discover, localClient, refreshTokens } from "../support/oauth-client.ts";
import { expectOAuthError, requireRecord, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";
import { refreshTokenGrant } from "../../auth/tokens/refresh-token.ts";
import { DiskOAuthStore } from "../../auth/storage/disk-store.ts";
import { readConfig } from "../../shared/config.ts";
import { staticUser } from "../../auth/static-user.ts";
import { ServiceError } from "../../shared/errors.ts";
import type { OAuthClient } from "../../auth/client-types.ts";

test("refresh token rotation revokes the token family on reuse", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  const firstRefreshToken = requireString(flow.tokens.refresh_token, "refresh_token");
  const rotated = await refreshTokens(flow.as, firstRefreshToken, service.actionsAudience);
  const secondRefreshToken = requireString(rotated.tokens.refresh_token, "refresh_token");
  assert.notEqual(secondRefreshToken, firstRefreshToken);
  const replay = await oauth.refreshTokenGrantRequest(flow.as, localClient, oauth.ClientSecretPost("local-test-secret"), firstRefreshToken, {
    additionalParameters: new URLSearchParams([["resource", service.actionsAudience]]),
    [oauth.allowInsecureRequests]: true,
  });
  await expectOAuthError(replay, 400, "invalid_grant");
  const revokedFamilyToken = await oauth.refreshTokenGrantRequest(flow.as, localClient, oauth.ClientSecretPost("local-test-secret"), secondRefreshToken, {
    additionalParameters: new URLSearchParams([["resource", service.actionsAudience]]),
    [oauth.allowInsecureRequests]: true,
  });
  await expectOAuthError(revokedFamilyToken, 400, "invalid_grant");
});

test("refresh token responses preserve the original ID token authentication time", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  const authTime = numberClaim(flow.idClaims.auth_time, "auth_time");
  await delay(1100);
  const refreshed = await refreshTokens(flow.as, requireString(flow.tokens.refresh_token, "refresh_token"), service.actionsAudience);
  const claims = decodeJwtPayload(requireString(refreshed.tokens.id_token, "id_token"));
  assert.equal(claims.auth_time, authTime);
  assert.ok(numberClaim(claims.iat, "iat") > authTime);
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
      resource: service.actionsAudience,
    }),
  });
  await expectOAuthError(mismatch, 400, "invalid_grant");
  assert.equal((await refreshTokens(flow.as, refreshToken, service.actionsAudience)).tokens.token_type, "bearer");
});

test("refresh token resource mismatch does not rotate the legitimate token", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  const flow = await completeAuthorizationCodeFlow(service);
  const refreshToken = requireString(flow.tokens.refresh_token, "refresh_token");
  const mismatch = await fetch(as.token_endpoint as string, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: "local-test",
      client_secret: "local-test-secret",
      refresh_token: refreshToken,
      resource: service.mcpResource,
    }),
  });
  await expectOAuthError(mismatch, 400, "invalid_grant");
  assert.equal((await refreshTokens(flow.as, refreshToken, service.actionsAudience)).tokens.token_type, "bearer");
});

test("refresh token grant rejects arbitrary invalid tokens", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  const response = await oauth.refreshTokenGrantRequest(as, localClient, oauth.ClientSecretPost("local-test-secret"), "not-a-valid-refresh-token", {
    additionalParameters: new URLSearchParams([["resource", service.actionsAudience]]),
    [oauth.allowInsecureRequests]: true,
  });
  await expectOAuthError(response, 400, "invalid_grant");
});

test("refresh token grant applies current client resource policy before rotating", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-refresh-policy-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const config = readConfig({ PUBLIC_ISSUER_URL: "http://localhost:4000", OAUTH_STORE_PATH: join(dir, "store.json") });
  const store = new DiskOAuthStore(config.oauthStorePath);
  const refreshToken = await store.createRefreshToken({
    clientId: "local-test",
    userSub: staticUser.sub,
    resource: config.actionsAudience,
    scopes: ["openid"],
    authTime: 1,
    ttlSeconds: 300,
  });
  await assert.rejects(
    () => refreshTokenGrant(config, store, clientWithResources([config.actionsAudience]), new URLSearchParams({ refresh_token: refreshToken })),
    (error) => error instanceof ServiceError && error.code === "invalid_target",
  );
  const form = new URLSearchParams({ refresh_token: refreshToken, resource: config.actionsAudience });
  await assert.rejects(
    () => refreshTokenGrant(config, store, clientWithResources([config.mcpResource]), form),
    (error) => error instanceof ServiceError && error.code === "invalid_target",
  );
  const response = await refreshTokenGrant(config, store, clientWithResources([config.actionsAudience]), form);
  assert.equal(response.token_type, "bearer");
});

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, encodedPayload] = token.split(".");
  const json = Buffer.from(requireString(encodedPayload, "jwt payload"), "base64url").toString("utf8");
  return requireRecord(JSON.parse(json), "jwt payload");
}

function clientWithResources(allowedResources: string[]): OAuthClient {
  return {
    clientId: "local-test",
    clientSecretHash: "a".repeat(43),
    displayName: "Local Test",
    redirectUris: ["http://localhost:4000/test/callback"],
    allowedScopes: ["openid"],
    allowedResources,
    tokenEndpointAuthMethod: "client_secret_post" as const,
    pkcePolicy: "optional" as const,
    clientClass: "local-test",
  };
}

function numberClaim(value: unknown, name: string): number {
  if (typeof value !== "number") assert.fail(`${name} must be a number`);
  return value;
}

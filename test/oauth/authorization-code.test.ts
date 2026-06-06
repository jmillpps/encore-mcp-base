import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { authorizeCode, completeAuthorizationCodeFlow, discover, exchangeCode, localClient, localRedirectUri } from "../support/oauth-client.ts";
import { readJson, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";

test("authorization code flow issues externally processed OIDC tokens and userinfo", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  assert.equal(flow.tokens.token_type, "bearer");
  assert.equal(flow.tokens.scope, "openid profile email");
  assert.equal(flow.idClaims.iss, service.origin);
  assert.equal(flow.idClaims.aud, localClient.client_id);
  assert.equal(flow.idClaims.email, "jmiller@inifnitedevlab.com");
  assert.equal(flow.idClaims.name, "Justin Miller");
  const userInfoResponse = await oauth.userInfoRequest(flow.as, localClient, flow.tokens.access_token, {
    [oauth.allowInsecureRequests]: true,
  });
  const userInfo = await oauth.processUserInfoResponse(flow.as, localClient, flow.idClaims.sub, userInfoResponse);
  assert.equal(userInfo.email, "jmiller@inifnitedevlab.com");
  const store = await readFile(service.storePath, "utf8");
  assert.equal(store.includes(flow.code), false);
  assert.equal(store.includes(requireString(flow.tokens.refresh_token, "refresh_token")), false);
});

test("authorization code flow preserves requested scope order while deduplicating", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service, service.actionsAudience, "profile openid email profile");
  assert.equal(flow.tokens.scope, "profile openid email");
});

test("authorization code cannot be reused after token exchange", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  const replay = await oauth.authorizationCodeGrantRequest(
    flow.as,
    localClient,
    oauth.ClientSecretPost("local-test-secret"),
    flow.callbackParameters,
    "http://localhost:4000/test/callback",
    flow.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.actionsAudience]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  assert.equal(replay.status, 400);
  const body = await readJson(replay);
  assert.equal(body.error, "invalid_grant");
});

test("authorization code flow carries OIDC nonce into the ID token", async (t) => {
  const service = await startService(t);
  const nonce = oauth.generateRandomNonce();
  const flow = await completeAuthorizationCodeFlow(service, service.actionsAudience, "openid profile email", nonce);
  assert.equal(flow.idClaims.nonce, nonce);
});

test("authorization code flow preserves authentication time across delayed exchange", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  const authorization = await authorizeCode(service, as, service.actionsAudience);
  await delay(1100);
  const { idClaims } = await exchangeCode(authorization, service.actionsAudience);
  assert.ok(numberClaim(idClaims.auth_time, "auth_time") < numberClaim(idClaims.iat, "iat"));
});

test("authorization endpoint rejects invalid state values before redirect", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  for (const state of ["a".repeat(513), "valid-prefix\ninvalid-suffix"]) {
    const response = await fetch(await authorizationUrl(as, service.actionsAudience, state), { redirect: "manual" });
    assert.equal(response.status, 400);
    assert.equal((await readJson(response)).error, "bad_request");
    assert.equal(response.headers.get("location"), null);
  }
});

test("expired authorization code cannot be exchanged", async (t) => {
  const service = await startService(t, { AUTHORIZATION_CODE_TTL_SECONDS: "1" });
  const flow = await completeAuthorizationCodeFlow(service);
  await delay(1100);
  const expired = await oauth.authorizationCodeGrantRequest(
    flow.as,
    localClient,
    oauth.ClientSecretPost("local-test-secret"),
    flow.callbackParameters,
    "http://localhost:4000/test/callback",
    flow.codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", service.actionsAudience]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  assert.equal(expired.status, 400);
  assert.equal((await readJson(expired)).error, "invalid_grant");
});

function numberClaim(value: unknown, name: string): number {
  if (typeof value !== "number") assert.fail(`${name} must be a number`);
  return value;
}

async function authorizationUrl(as: oauth.AuthorizationServer, resource: string, state: string): Promise<URL> {
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const url = new URL(requireString(as.authorization_endpoint, "authorization_endpoint"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", localClient.client_id);
  url.searchParams.set("redirect_uri", localRedirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("resource", resource);
  url.searchParams.set("code_challenge", await oauth.calculatePKCECodeChallenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

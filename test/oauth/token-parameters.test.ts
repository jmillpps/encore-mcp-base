import assert from "node:assert/strict";
import test from "node:test";
import { authorizeCode, completeAuthorizationCodeFlow, discover, exchangeCode, localClientSecret, localRedirectUri, refreshTokens } from "../support/oauth-client.ts";
import { expectOAuthError, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";

test("authorization code grant rejects refresh-token parameters without consuming the code", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  const authorization = await authorizeCode(service, as, service.actionsAudience);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: "local-test",
    client_secret: localClientSecret,
    code: authorization.code,
    redirect_uri: localRedirectUri,
    code_verifier: authorization.codeVerifier,
    resource: service.actionsAudience,
    refresh_token: "not-part-of-this-grant",
  });
  await expectOAuthError(await postToken(as.token_endpoint, body), 400, "bad_request");
  assert.equal((await exchangeCode(authorization, service.actionsAudience)).tokens.token_type, "bearer");
});

test("authorization code grant requires resource without consuming the code", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  const authorization = await authorizeCode(service, as, service.actionsAudience);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: "local-test",
    client_secret: localClientSecret,
    code: authorization.code,
    redirect_uri: localRedirectUri,
    code_verifier: authorization.codeVerifier,
  });
  await expectOAuthError(await postToken(as.token_endpoint, body), 400, "invalid_target");
  assert.equal((await exchangeCode(authorization, service.actionsAudience)).tokens.token_type, "bearer");
});

test("authorization code grant rejects unallowed resource without consuming the code", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  const authorization = await authorizeCode(service, as, service.actionsAudience);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: "local-test",
    client_secret: localClientSecret,
    code: authorization.code,
    redirect_uri: localRedirectUri,
    code_verifier: authorization.codeVerifier,
    resource: "http://invalid.test/resource",
  });
  await expectOAuthError(await postToken(as.token_endpoint, body), 400, "invalid_target");
  assert.equal((await exchangeCode(authorization, service.actionsAudience)).tokens.token_type, "bearer");
});

test("refresh token grant rejects authorization-code parameters without rotating the token", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  const refreshToken = requireString(flow.tokens.refresh_token, "refresh_token");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: "local-test",
    client_secret: localClientSecret,
    refresh_token: refreshToken,
    resource: service.actionsAudience,
    code: "not-part-of-this-grant",
  });
  await expectOAuthError(await postToken(flow.as.token_endpoint, body), 400, "bad_request");
  assert.equal((await refreshTokens(flow.as, refreshToken, service.actionsAudience)).tokens.token_type, "bearer");
});

test("refresh token grant requires resource without rotating the token", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  const refreshToken = requireString(flow.tokens.refresh_token, "refresh_token");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: "local-test",
    client_secret: localClientSecret,
    refresh_token: refreshToken,
  });
  await expectOAuthError(await postToken(flow.as.token_endpoint, body), 400, "invalid_target");
  assert.equal((await refreshTokens(flow.as, refreshToken, service.actionsAudience)).tokens.token_type, "bearer");
});

test("refresh token grant rejects unallowed resource without rotating the token", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  const refreshToken = requireString(flow.tokens.refresh_token, "refresh_token");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: "local-test",
    client_secret: localClientSecret,
    refresh_token: refreshToken,
    resource: "http://invalid.test/resource",
  });
  await expectOAuthError(await postToken(flow.as.token_endpoint, body), 400, "invalid_target");
  assert.equal((await refreshTokens(flow.as, refreshToken, service.actionsAudience)).tokens.token_type, "bearer");
});

function postToken(tokenEndpoint: string | undefined, body: URLSearchParams): Promise<Response> {
  return fetch(requireString(tokenEndpoint, "token_endpoint"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

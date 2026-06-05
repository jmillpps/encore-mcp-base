import assert from "node:assert/strict";
import test from "node:test";
import { authorizeCode, discover, exchangeCode, localClientSecret } from "../support/oauth-client.ts";
import { expectOAuthError, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";

test("authorization endpoint rejects invalid client request parameters", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  await expectOAuthError(await fetch(authorizeUrl(as.authorization_endpoint, service.actionsAudience, { state: "" }), { redirect: "manual" }), 400, "bad_request");
  await expectOAuthError(await fetch(authorizeUrl(as.authorization_endpoint, service.actionsAudience, { redirectUri: "http://evil.test/callback" }), { redirect: "manual" }), 400, "bad_request");
  await expectOAuthError(await fetch(authorizeUrl(as.authorization_endpoint, service.actionsAudience, { scope: "openid admin" }), { redirect: "manual" }), 400, "invalid_scope");
  const duplicateClient = authorizeUrl(as.authorization_endpoint, service.actionsAudience, {});
  duplicateClient.searchParams.append("client_id", "local-test");
  await expectOAuthError(await fetch(duplicateClient, { redirect: "manual" }), 400, "bad_request");
  const unsupportedParameter = authorizeUrl(as.authorization_endpoint, service.actionsAudience, {});
  unsupportedParameter.searchParams.set("prompt", "consent");
  await expectOAuthError(await fetch(unsupportedParameter, { redirect: "manual" }), 400, "bad_request");
  await expectOAuthError(
    await fetch(authorizeUrl(as.authorization_endpoint, service.mcpResource, { clientId: "gpt-apps-mcp", redirectUri: "https://chatgpt.com/connector/oauth/local-callback", codeChallenge: "" }), {
      redirect: "manual",
    }),
    400,
    "bad_request",
  );
});

test("token endpoint rejects invalid secrets without consuming the authorization code", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  const authorization = await authorizeCode(service, as, service.actionsAudience);
  const wrongSecret = await tokenRequest(as.token_endpoint, service.actionsAudience, authorization.code, authorization.codeVerifier, "bad-secret");
  await expectOAuthError(wrongSecret, 401, "invalid_client");
  const exchanged = await exchangeCode(authorization, service.actionsAudience);
  assert.equal(exchanged.tokens.token_type, "bearer");
});

test("token endpoint rejects bad redirect and bad PKCE without consuming the authorization code", async (t) => {
  const service = await startService(t);
  const as = await discover(service);
  const redirectAuthorization = await authorizeCode(service, as, service.actionsAudience);
  const badRedirect = await tokenRequest(as.token_endpoint, service.actionsAudience, redirectAuthorization.code, redirectAuthorization.codeVerifier, localClientSecret, "http://localhost:4000/wrong");
  await expectOAuthError(badRedirect, 400, "invalid_grant");
  assert.equal((await exchangeCode(redirectAuthorization, service.actionsAudience)).tokens.token_type, "bearer");
  const pkceAuthorization = await authorizeCode(service, as, service.actionsAudience);
  const badVerifier = await tokenRequest(as.token_endpoint, service.actionsAudience, pkceAuthorization.code, "bad-verifier", localClientSecret);
  await expectOAuthError(badVerifier, 400, "invalid_grant");
  assert.equal((await exchangeCode(pkceAuthorization, service.actionsAudience)).tokens.token_type, "bearer");
  const duplicateAuthorization = await authorizeCode(service, as, service.actionsAudience);
  const duplicateCode = tokenBody(service.actionsAudience, duplicateAuthorization.code, duplicateAuthorization.codeVerifier, localClientSecret);
  duplicateCode.append("code", duplicateAuthorization.code);
  await expectOAuthError(await postToken(as.token_endpoint, duplicateCode), 400, "bad_request");
  assert.equal((await exchangeCode(duplicateAuthorization, service.actionsAudience)).tokens.token_type, "bearer");
  const missingVerifierAuthorization = await authorizeCode(service, as, service.actionsAudience);
  const missingVerifier = tokenBody(service.actionsAudience, missingVerifierAuthorization.code, missingVerifierAuthorization.codeVerifier, localClientSecret);
  missingVerifier.delete("code_verifier");
  await expectOAuthError(await postToken(as.token_endpoint, missingVerifier), 400, "invalid_grant");
  assert.equal((await exchangeCode(missingVerifierAuthorization, service.actionsAudience)).tokens.token_type, "bearer");
});

async function tokenRequest(
  tokenEndpoint: string | undefined,
  resource: string,
  code: string,
  codeVerifier: string,
  clientSecret: string,
  redirectUri = "http://localhost:4000/test/callback",
): Promise<Response> {
  const endpoint = requireString(tokenEndpoint, "token_endpoint");
  return postToken(endpoint, tokenBody(resource, code, codeVerifier, clientSecret, redirectUri));
}

function postToken(tokenEndpoint: string | undefined, body: URLSearchParams): Promise<Response> {
  const endpoint = requireString(tokenEndpoint, "token_endpoint");
  return fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

function tokenBody(resource: string, code: string, codeVerifier: string, clientSecret: string, redirectUri = "http://localhost:4000/test/callback"): URLSearchParams {
  return new URLSearchParams({
    grant_type: "authorization_code",
    client_id: "local-test",
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    resource,
  });
}

function authorizeUrl(endpoint: string | undefined, resource: string, overrides: Record<string, string>): URL {
  const url = new URL(requireString(endpoint, "authorization_endpoint"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", overrides.clientId ?? "local-test");
  url.searchParams.set("redirect_uri", overrides.redirectUri ?? "http://localhost:4000/test/callback");
  url.searchParams.set("scope", overrides.scope ?? "openid profile email");
  url.searchParams.set("state", overrides.state ?? "state");
  url.searchParams.set("resource", resource);
  if (overrides.codeChallenge !== "") {
    url.searchParams.set("code_challenge", overrides.codeChallenge ?? "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url;
}

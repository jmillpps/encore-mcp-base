import assert from "node:assert/strict";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, discover, localClient, localRedirectUri, manualRedirect } from "../support/oauth-client.ts";
import { readJson, requireString } from "../support/http.ts";
import { startService } from "../support/service-process.ts";
import { testUserProfile } from "../support/user-profile.ts";
import { startUpstreamOidcServer, type UpstreamOidcServer } from "../support/upstream-oidc.ts";

const upstreamUser = {
  sub: "upstream-user",
  given_name: "Upstream",
  family_name: "Member",
  name: "Upstream Member",
  preferred_username: "upstream.member",
  email: "upstream@example.test",
  email_verified: true,
};

test("upstream OIDC provider authenticates before service tokens are issued", async (t) => {
  const upstream = await startUpstreamOidcServer(t, upstreamUser);
  const service = await startService(t, (origin) => upstreamOidcEnv(origin, upstream));
  const as = await discover(service);
  const { tokens, idClaims } = await completeAuthorizationCodeFlow(service);
  assert.equal(idClaims.sub, upstreamUser.sub);
  assert.equal(idClaims.email, upstreamUser.email);
  assert.notEqual(idClaims.email, testUserProfile.email);
  const userInfoResponse = await oauth.userInfoRequest(as, localClient, tokens.access_token, { [oauth.allowInsecureRequests]: true });
  const userInfo = await oauth.processUserInfoResponse(as, localClient, idClaims.sub, userInfoResponse);
  assert.equal(userInfo.email, upstreamUser.email);
  const profile = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: `Bearer ${tokens.access_token}` } });
  assert.equal(profile.status, 200);
  assert.equal((await readJson(profile)).email, upstreamUser.email);
});

test("upstream OIDC supports client secret basic token authentication", async (t) => {
  const upstream = await startUpstreamOidcServer(t, upstreamUser);
  const service = await startService(t, (origin) => ({ ...upstreamOidcEnv(origin, upstream), UPSTREAM_OIDC_TOKEN_AUTH_METHOD: "client_secret_basic" }));
  const flow = await completeAuthorizationCodeFlow(service);
  assert.equal(flow.idClaims.email, upstreamUser.email);
});

test("upstream OIDC accepts signed userinfo bound to the ID token subject", async (t) => {
  const upstream = await startUpstreamOidcServer(t, upstreamUser, { signedUserinfo: true });
  const service = await startService(t, (origin) => upstreamOidcEnv(origin, upstream));
  const flow = await completeAuthorizationCodeFlow(service);
  assert.equal(flow.idClaims.email, upstreamUser.email);
});

test("upstream OIDC rejects discovery issuer mismatch", async (t) => {
  const upstream = await startUpstreamOidcServer(t, upstreamUser, { metadataClaims: { issuer: "https://issuer.example.test" } });
  const service = await startService(t, (origin) => upstreamOidcEnv(origin, upstream));
  await expectUpstreamCallbackFailure(service, "invalid_grant");
});

test("upstream OIDC rejects missing ID token", async (t) => {
  const upstream = await startUpstreamOidcServer(t, upstreamUser, { omitIdToken: true });
  const service = await startService(t, (origin) => upstreamOidcEnv(origin, upstream));
  await expectUpstreamCallbackFailure(service, "invalid_grant");
});

test("upstream OIDC rejects ID token nonce mismatch", async (t) => {
  const upstream = await startUpstreamOidcServer(t, upstreamUser, { idTokenClaims: { nonce: "wrongnonce" } });
  const service = await startService(t, (origin) => upstreamOidcEnv(origin, upstream));
  await expectUpstreamCallbackFailure(service, "invalid_grant");
});

test("upstream OIDC rejects userinfo subject mismatch", async (t) => {
  const upstream = await startUpstreamOidcServer(t, upstreamUser, { userinfoClaims: { sub: "other-upstream-user" } });
  const service = await startService(t, (origin) => upstreamOidcEnv(origin, upstream));
  await expectUpstreamCallbackFailure(service, "invalid_grant");
});

test("default test identity comes from the local upstream OIDC server", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  assert.equal(flow.idClaims.email, testUserProfile.email);
});

function upstreamOidcEnv(origin: string, upstream: UpstreamOidcServer): NodeJS.ProcessEnv {
  return {
    UPSTREAM_OIDC_ISSUER_URL: upstream.issuer,
    UPSTREAM_OIDC_DISCOVERY_URL: upstream.discoveryUrl,
    UPSTREAM_OIDC_AUTHORIZATION_URL: upstream.authorizationUrl,
    UPSTREAM_OIDC_TOKEN_URL: upstream.tokenUrl,
    UPSTREAM_OIDC_USERINFO_URL: upstream.userinfoUrl,
    UPSTREAM_OIDC_CLIENT_ID: upstream.clientId,
    UPSTREAM_OIDC_CLIENT_SECRET: upstream.clientSecret,
    UPSTREAM_OIDC_REDIRECT_URI: `${origin}/oauth/callback`,
    UPSTREAM_OIDC_SCOPES: "openid profile email",
  };
}

async function expectUpstreamCallbackFailure(service: Awaited<ReturnType<typeof startService>>, error: string): Promise<void> {
  const as = await discover(service);
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.generateRandomState();
  const endpoint = requireString(as.authorization_endpoint, "authorization_endpoint");
  const url = new URL(endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", localClient.client_id);
  url.searchParams.set("redirect_uri", localRedirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("resource", service.actionsAudience);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  const upstreamRedirect = await manualRedirect(url);
  const serviceCallback = await manualRedirect(upstreamRedirect);
  const response = await fetch(serviceCallback, { redirect: "manual" });
  assert.equal(response.status, 400);
  assert.equal((await readJson(response)).error, error);
}

import assert from "node:assert/strict";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, discover, localClient } from "../support/oauth-client.ts";
import { readJson } from "../support/http.ts";
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

test("default test identity comes from the local upstream OIDC server", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  assert.equal(flow.idClaims.email, testUserProfile.email);
});

function upstreamOidcEnv(origin: string, upstream: UpstreamOidcServer): NodeJS.ProcessEnv {
  return {
    UPSTREAM_OIDC_ISSUER_URL: upstream.issuer,
    UPSTREAM_OIDC_AUTHORIZATION_URL: upstream.authorizationUrl,
    UPSTREAM_OIDC_TOKEN_URL: upstream.tokenUrl,
    UPSTREAM_OIDC_USERINFO_URL: upstream.userinfoUrl,
    UPSTREAM_OIDC_CLIENT_ID: upstream.clientId,
    UPSTREAM_OIDC_CLIENT_SECRET: upstream.clientSecret,
    UPSTREAM_OIDC_REDIRECT_URI: `${origin}/oauth/callback`,
    UPSTREAM_OIDC_SCOPES: "openid profile email",
  };
}

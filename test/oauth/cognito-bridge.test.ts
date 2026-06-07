import assert from "node:assert/strict";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, discover, exchangeCode, localClient, localRedirectUri } from "../support/oauth-client.ts";
import { readJson, requireString } from "../support/http.ts";
import { startService, type TestService } from "../support/service-process.ts";
import { testStaticUser } from "../support/static-user.ts";
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

test("Cognito bridge authenticates upstream before issuing service tokens", async (t) => {
  const upstream = await startUpstreamOidcServer(t, upstreamUser);
  const service = await startService(t, (origin) => cognitoEnv(origin, upstream));
  const as = await discover(service);
  const authorization = await authorizeThroughUpstream(service, as);
  const { tokens, idClaims } = await exchangeCode(authorization, service.actionsAudience);
  assert.equal(idClaims.sub, upstreamUser.sub);
  assert.equal(idClaims.email, upstreamUser.email);
  assert.notEqual(idClaims.email, testStaticUser.email);
  const userInfoResponse = await oauth.userInfoRequest(as, localClient, tokens.access_token, { [oauth.allowInsecureRequests]: true });
  const userInfo = await oauth.processUserInfoResponse(as, localClient, idClaims.sub, userInfoResponse);
  assert.equal(userInfo.email, upstreamUser.email);
  const profile = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: `Bearer ${tokens.access_token}` } });
  assert.equal(profile.status, 200);
  assert.equal((await readJson(profile)).email, upstreamUser.email);
});

test("local authorization still issues configured local profile when Cognito is disabled", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service);
  assert.equal(flow.idClaims.email, testStaticUser.email);
});

async function authorizeThroughUpstream(service: TestService, as: oauth.AuthorizationServer): Promise<{
  as: oauth.AuthorizationServer;
  callbackParameters: URLSearchParams;
  codeVerifier: string;
  code: string;
}> {
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.generateRandomState();
  const url = new URL(requireString(as.authorization_endpoint, "authorization_endpoint"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", localClient.client_id);
  url.searchParams.set("redirect_uri", localRedirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("resource", service.actionsAudience);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  const upstreamRedirect = await manualRedirect(url);
  assert.equal(upstreamRedirect.origin.startsWith("http://127.0.0.1:"), true);
  const callbackRedirect = await manualRedirect(upstreamRedirect);
  assert.equal(callbackRedirect.origin, service.origin);
  const serviceRedirect = await manualRedirect(callbackRedirect);
  assert.equal(serviceRedirect.origin, new URL(localRedirectUri).origin);
  const callbackParameters = oauth.validateAuthResponse(as, localClient, serviceRedirect, state);
  const code = requireString(callbackParameters.get("code"), "code");
  return { as, callbackParameters, codeVerifier, code };
}

async function manualRedirect(url: URL): Promise<URL> {
  const response = await fetch(url, { redirect: "manual" });
  assert.equal(response.status, 302);
  return new URL(requireString(response.headers.get("location"), "location"));
}

function cognitoEnv(origin: string, upstream: UpstreamOidcServer): NodeJS.ProcessEnv {
  return {
    COGNITO_ENABLED: "true",
    COGNITO_ISSUER_URL: upstream.issuer,
    COGNITO_AUTHORIZATION_URL: upstream.authorizationUrl,
    COGNITO_TOKEN_URL: upstream.tokenUrl,
    COGNITO_USERINFO_URL: upstream.userinfoUrl,
    COGNITO_CLIENT_ID: upstream.clientId,
    COGNITO_CLIENT_SECRET: upstream.clientSecret,
    COGNITO_REDIRECT_URI: `${origin}/oauth/cognito/callback`,
    COGNITO_SCOPES: "openid profile email",
  };
}

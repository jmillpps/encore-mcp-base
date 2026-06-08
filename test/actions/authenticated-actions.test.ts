import assert from "node:assert/strict";
import test from "node:test";
import * as oauth from "oauth4webapi";
import { completeAuthorizationCodeFlow, manualRedirect } from "../support/oauth-client.ts";
import { readJson, requireString } from "../support/http.ts";
import { bearer } from "../support/mcp.ts";
import { startService, type TestService } from "../support/service-process.ts";
import { testUserProfile } from "../support/user-profile.ts";

const gptActionsClient: oauth.Client = { client_id: "gpt-actions" };
const gptActionsClientSecret = "gpt-actions-secret";
const gptActionsRedirectUri = "https://chatgpt.com/aip/g-local/oauth/callback";

test("Actions endpoints reject missing tokens and accept scoped Actions tokens", async (t) => {
  const service = await startService(t);
  const missingToken = await fetch(`${service.origin}/actions/profile`);
  assert.equal(missingToken.status, 401);
  const missingTokenError = await readJson(missingToken);
  assert.equal(missingTokenError.code, "unauthenticated");
  assert.equal(missingTokenError.internal_message, null);
  const flow = await completeAuthorizationCodeFlow(service, service.actionsAudience);
  const profile = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(profile.status, 200);
  assert.equal((await readJson(profile)).email, testUserProfile.email);
  const lowerCaseProfile = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: `bearer ${flow.tokens.access_token}` } });
  assert.equal(lowerCaseProfile.status, 200);
  assert.equal((await readJson(lowerCaseProfile)).email, testUserProfile.email);
  const session = await fetch(`${service.origin}/actions/session`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(session.status, 200);
  assert.equal((await readJson(session)).audience, service.actionsAudience);
  const queryProfile = await fetch(`${service.origin}/actions/profile?access_token=query-token`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(queryProfile.status, 400);
  assert.equal((await readJson(queryProfile)).code, "invalid_argument");
  const querySession = await fetch(`${service.origin}/actions/session?access_token=query-token`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(querySession.status, 400);
  assert.equal((await readJson(querySession)).code, "invalid_argument");
});

test("GPT Actions OAuth can link and refresh without resource parameters", async (t) => {
  const service = await startService(t);
  const flow = await completeGptActionsFlowWithoutResource(service);
  const profile = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(profile.status, 200);
  assert.equal((await readJson(profile)).email, testUserProfile.email);
  const session = await fetch(`${service.origin}/actions/session`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(session.status, 200);
  assert.equal((await readJson(session)).audience, service.actionsAudience);
  const refreshToken = requireString(flow.tokens.refresh_token, "refresh_token");
  const refreshed = await refreshGptActionsTokens(flow.as, refreshToken);
  const refreshedSession = await fetch(`${service.origin}/actions/session`, { headers: { authorization: bearer(refreshed.tokens.access_token) } });
  assert.equal(refreshedSession.status, 200);
  assert.equal((await readJson(refreshedSession)).audience, service.actionsAudience);
});

test("Actions endpoints reject MCP audience tokens", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const response = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(response.status, 401);
});

test("Actions profile requires profile and email scopes", async (t) => {
  const service = await startService(t);
  const flow = await completeAuthorizationCodeFlow(service, service.actionsAudience, "openid");
  const profile = await fetch(`${service.origin}/actions/profile`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(profile.status, 403);
  const profileError = await readJson(profile);
  assert.equal(profileError.code, "permission_denied");
  assert.equal(profileError.internal_message, null);
  const session = await fetch(`${service.origin}/actions/session`, { headers: { authorization: bearer(flow.tokens.access_token) } });
  assert.equal(session.status, 200);
  assert.deepEqual((await readJson(session)).scopes, ["openid"]);
});

async function completeGptActionsFlowWithoutResource(service: TestService): Promise<{
  as: oauth.AuthorizationServer;
  tokens: oauth.TokenEndpointResponse;
  idClaims: oauth.IDToken;
}> {
  const as = await discoverActionsServer(service);
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.generateRandomState();
  const url = new URL(requireString(as.authorization_endpoint, "authorization_endpoint"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", gptActionsClient.client_id);
  url.searchParams.set("redirect_uri", gptActionsRedirectUri);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  const upstreamRedirect = await manualRedirect(url);
  const serviceCallbackRedirect = await manualRedirect(upstreamRedirect);
  const callbackUrl = await manualRedirect(serviceCallbackRedirect);
  const callbackParameters = oauth.validateAuthResponse(as, gptActionsClient, callbackUrl, state);
  const tokenResponse = await oauth.authorizationCodeGrantRequest(
    as,
    gptActionsClient,
    oauth.ClientSecretPost(gptActionsClientSecret),
    callbackParameters,
    gptActionsRedirectUri,
    codeVerifier,
    { [oauth.allowInsecureRequests]: true },
  );
  const tokens = await oauth.processAuthorizationCodeResponse(as, gptActionsClient, tokenResponse, {
    requireIdToken: true,
    expectedNonce: oauth.expectNoNonce,
  });
  await oauth.validateApplicationLevelSignature(as, tokenResponse, { [oauth.allowInsecureRequests]: true });
  const idClaims = oauth.getValidatedIdTokenClaims(tokens);
  assert.ok(idClaims);
  return { as, tokens, idClaims };
}

async function refreshGptActionsTokens(as: oauth.AuthorizationServer, refreshToken: string): Promise<{ response: Response; tokens: oauth.TokenEndpointResponse }> {
  const response = await oauth.refreshTokenGrantRequest(as, gptActionsClient, oauth.ClientSecretPost(gptActionsClientSecret), refreshToken, {
    [oauth.allowInsecureRequests]: true,
  });
  const tokens = await oauth.processRefreshTokenResponse(as, gptActionsClient, response);
  return { response, tokens };
}

async function discoverActionsServer(service: TestService): Promise<oauth.AuthorizationServer> {
  const response = await fetch(`${service.origin}/.well-known/openid-configuration`);
  return oauth.processDiscoveryResponse(new URL(service.origin), response);
}

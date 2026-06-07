import assert from "node:assert/strict";
import * as oauth from "oauth4webapi";
import { requireString } from "./http.ts";
import type { TestService } from "./service-process.ts";

export const localClient: oauth.Client = { client_id: "local-test" };
export const localClientSecret = "local-test-secret";
export const localRedirectUri = "http://localhost:4000/test/callback";

export interface AuthorizedCode {
  as: oauth.AuthorizationServer;
  callbackParameters: URLSearchParams;
  codeVerifier: string;
  code: string;
}

export interface CompletedFlow extends AuthorizedCode {
  tokens: oauth.TokenEndpointResponse;
  idClaims: oauth.IDToken;
}

export async function discover(service: TestService): Promise<oauth.AuthorizationServer> {
  const response = await fetch(`${service.origin}/.well-known/openid-configuration`);
  return oauth.processDiscoveryResponse(new URL(service.origin), response);
}

export async function authorizeCode(
  service: TestService,
  as: oauth.AuthorizationServer,
  resource: string,
  scope = "openid profile email",
  nonce?: string,
): Promise<AuthorizedCode> {
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.generateRandomState();
  const url = new URL(requiredEndpoint(as.authorization_endpoint, "authorization_endpoint"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", localClient.client_id);
  url.searchParams.set("redirect_uri", localRedirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("resource", resource);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (nonce) url.searchParams.set("nonce", nonce);
  const response = await fetch(url, { redirect: "manual" });
  assert.equal(response.status, 302);
  const location = requireString(response.headers.get("location"), "location");
  const callbackUrl = new URL(location);
  const callbackParameters = oauth.validateAuthResponse(as, localClient, callbackUrl, state);
  const code = requireString(callbackParameters.get("code"), "code");
  return { as, callbackParameters, codeVerifier, code };
}

export async function exchangeCode(
  authorization: AuthorizedCode,
  resource: string,
  codeVerifier = authorization.codeVerifier,
  expectedNonce?: string,
): Promise<{ response: Response; tokens: oauth.TokenEndpointResponse; idClaims: oauth.IDToken }> {
  const response = await oauth.authorizationCodeGrantRequest(
    authorization.as,
    localClient,
    oauth.ClientSecretPost(localClientSecret),
    authorization.callbackParameters,
    localRedirectUri,
    codeVerifier,
    {
      additionalParameters: new URLSearchParams([["resource", resource]]),
      [oauth.allowInsecureRequests]: true,
    },
  );
  const tokens = await oauth.processAuthorizationCodeResponse(authorization.as, localClient, response, {
    requireIdToken: true,
    expectedNonce: expectedNonce ?? oauth.expectNoNonce,
  });
  await oauth.validateApplicationLevelSignature(authorization.as, response, { [oauth.allowInsecureRequests]: true });
  const idClaims = oauth.getValidatedIdTokenClaims(tokens);
  assert.ok(idClaims);
  return { response, tokens, idClaims };
}

export async function completeAuthorizationCodeFlow(
  service: TestService,
  resource = service.actionsAudience,
  scope = "openid profile email",
  nonce?: string,
): Promise<CompletedFlow> {
  const as = await discover(service);
  const authorization = await authorizeCode(service, as, resource, scope, nonce);
  const { tokens, idClaims } = await exchangeCode(authorization, resource, authorization.codeVerifier, nonce);
  return { ...authorization, tokens, idClaims };
}

export async function refreshTokens(
  as: oauth.AuthorizationServer,
  refreshToken: string,
  resource: string,
): Promise<{ response: Response; tokens: oauth.TokenEndpointResponse }> {
  const response = await oauth.refreshTokenGrantRequest(as, localClient, oauth.ClientSecretPost(localClientSecret), refreshToken, {
    additionalParameters: new URLSearchParams([["resource", resource]]),
    [oauth.allowInsecureRequests]: true,
  });
  const tokens = await oauth.processRefreshTokenResponse(as, localClient, response);
  return { response, tokens };
}

function requiredEndpoint(value: string | undefined, name: string): string {
  if (typeof value !== "string") assert.fail(`${name} must be discovered`);
  return value;
}

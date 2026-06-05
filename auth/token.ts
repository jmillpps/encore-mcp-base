import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { assertClientAuthMethod, assertClientSecret, assertResource, findClient, type OAuthClient } from "./clients.ts";
import { readClientCredentials } from "./client-auth.ts";
import { assertAllowedParameters, optionalParameter, requiredParameter } from "./oauth-parameters.ts";
import { staticUser } from "./static-user.ts";
import { DiskOAuthStore } from "./storage/disk-store.ts";
import { issueAccessToken } from "./tokens/access-token.ts";
import { issueIdToken } from "./tokens/id-token.ts";

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
}

export async function handleTokenGrant(
  config: ServiceConfig,
  store: DiskOAuthStore,
  clients: readonly OAuthClient[],
  form: URLSearchParams,
  authorization: string | undefined,
): Promise<TokenResponse> {
  assertAllowedParameters(form, ["grant_type", "client_id", "client_secret", "code", "redirect_uri", "code_verifier", "resource", "refresh_token"]);
  const grant = optionalParameter(form, "grant_type");
  assertAllowedParameters(form, tokenGrantParameters(grant));
  const credentials = readClientCredentials(form, authorization);
  const client = findClient(clients, credentials.clientId);
  assertClientAuthMethod(client, credentials.method);
  assertClientSecret(client, credentials.clientSecret);
  if (grant === "authorization_code") return authorizationCodeGrant(config, store, client, form);
  if (grant === "refresh_token") return refreshTokenGrant(config, store, client, form);
  throw new ServiceError("bad_request", "unsupported grant_type", 400);
}

function tokenGrantParameters(grant: string | undefined): string[] {
  if (grant === "authorization_code") return ["grant_type", "client_id", "client_secret", "code", "redirect_uri", "code_verifier", "resource"];
  if (grant === "refresh_token") return ["grant_type", "client_id", "client_secret", "refresh_token", "resource"];
  return ["grant_type", "client_id", "client_secret"];
}

async function authorizationCodeGrant(config: ServiceConfig, store: DiskOAuthStore, client: OAuthClient, form: URLSearchParams): Promise<TokenResponse> {
  const code = requiredParameter(form, "code");
  const redirectUri = requiredParameter(form, "redirect_uri");
  const requestedResource = optionalParameter(form, "resource");
  const record = await store.consumeAuthorizationCode(code, optionalParameter(form, "code_verifier"), {
    clientId: client.clientId,
    redirectUri,
    ...(requestedResource !== undefined ? { resource: requestedResource } : {}),
  });
  const resource = requestedResource ?? record.resource;
  assertResource(client, resource);
  const refreshToken = await store.createRefreshToken({
    clientId: client.clientId,
    resource,
    scopes: record.scopes,
    userSub: record.userSub,
    ttlSeconds: config.refreshTokenTtlSeconds,
  });
  return tokenResponse(config, client.clientId, resource, record.scopes, refreshToken, record.nonce);
}

async function refreshTokenGrant(config: ServiceConfig, store: DiskOAuthStore, client: OAuthClient, form: URLSearchParams): Promise<TokenResponse> {
  const token = requiredParameter(form, "refresh_token");
  const rotated = await store.rotateRefreshToken(token, client.clientId, config.refreshTokenTtlSeconds, optionalParameter(form, "resource"));
  return tokenResponse(config, client.clientId, rotated.oldRecord.resource, rotated.oldRecord.scopes, rotated.newToken);
}

function tokenResponse(config: ServiceConfig, clientId: string, resource: string, scopes: string[], refreshToken: string, nonce?: string): TokenResponse {
  const response: TokenResponse = {
    access_token: issueAccessToken(config, { sub: staticUser.sub, clientId, audience: resource, scopes }),
    token_type: "bearer",
    expires_in: config.accessTokenTtlSeconds,
    refresh_token: refreshToken,
    scope: scopes.join(" "),
  };
  if (scopes.includes("openid")) response.id_token = issueIdToken(config, staticUser, clientId, nonce);
  return response;
}

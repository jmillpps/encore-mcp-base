import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { assertClientSecret, assertResource, findClient, type OAuthClient } from "./clients.ts";
import { readClientCredentials } from "./client-auth.ts";
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
  const credentials = readClientCredentials(form, authorization);
  const client = findClient(clients, credentials.clientId);
  assertClientSecret(client, credentials.clientSecret);
  const grant = form.get("grant_type");
  if (grant === "authorization_code") return authorizationCodeGrant(config, store, client, form);
  if (grant === "refresh_token") return refreshTokenGrant(config, store, client, form);
  throw new ServiceError("bad_request", "unsupported grant_type", 400);
}

async function authorizationCodeGrant(config: ServiceConfig, store: DiskOAuthStore, client: OAuthClient, form: URLSearchParams): Promise<TokenResponse> {
  const code = form.get("code");
  const redirectUri = form.get("redirect_uri");
  if (!code || !redirectUri) throw new ServiceError("invalid_grant", "invalid grant", 400);
  const record = await store.consumeAuthorizationCode(code, form.get("code_verifier") ?? undefined);
  if (record.clientId !== client.clientId || record.redirectUri !== redirectUri) {
    throw new ServiceError("invalid_grant", "invalid grant", 400);
  }
  const resource = form.get("resource") ?? record.resource;
  if (resource !== record.resource) throw new ServiceError("invalid_grant", "invalid grant", 400);
  assertResource(client, resource);
  const refreshToken = await store.createRefreshToken({
    clientId: client.clientId,
    resource,
    scopes: record.scopes,
    userSub: record.userSub,
    ttlSeconds: config.refreshTokenTtlSeconds,
  });
  return tokenResponse(config, client.clientId, resource, record.scopes, refreshToken);
}

async function refreshTokenGrant(config: ServiceConfig, store: DiskOAuthStore, client: OAuthClient, form: URLSearchParams): Promise<TokenResponse> {
  const token = form.get("refresh_token");
  if (!token) throw new ServiceError("invalid_grant", "invalid grant", 400);
  const rotated = await store.rotateRefreshToken(token, config.refreshTokenTtlSeconds);
  if (rotated.oldRecord.clientId !== client.clientId) throw new ServiceError("invalid_grant", "invalid grant", 400);
  return tokenResponse(config, client.clientId, rotated.oldRecord.resource, rotated.oldRecord.scopes, rotated.newToken);
}

function tokenResponse(config: ServiceConfig, clientId: string, resource: string, scopes: string[], refreshToken: string): TokenResponse {
  const response: TokenResponse = {
    access_token: issueAccessToken(config, { sub: staticUser.sub, clientId, audience: resource, scopes }),
    token_type: "bearer",
    expires_in: config.accessTokenTtlSeconds,
    refresh_token: refreshToken,
    scope: scopes.join(" "),
  };
  if (scopes.includes("openid")) response.id_token = issueIdToken(config, staticUser, clientId);
  return response;
}

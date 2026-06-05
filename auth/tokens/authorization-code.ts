import type { ServiceConfig } from "../../shared/config.ts";
import { assertResource, type OAuthClient } from "../clients.ts";
import { optionalParameter, requiredParameter } from "../oauth-parameters.ts";
import type { DiskOAuthStore } from "../storage/disk-store.ts";
import { issueTokenResponse, type TokenResponse } from "./token-response.ts";

export async function authorizationCodeGrant(config: ServiceConfig, store: DiskOAuthStore, client: OAuthClient, form: URLSearchParams): Promise<TokenResponse> {
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
    authTime: record.authTime,
    ttlSeconds: config.refreshTokenTtlSeconds,
  });
  return issueTokenResponse(config, {
    clientId: client.clientId,
    resource,
    scopes: record.scopes,
    refreshToken,
    authTime: record.authTime,
    nonce: record.nonce,
  });
}

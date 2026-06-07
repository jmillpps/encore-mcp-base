import type { ServiceConfig } from "../../shared/config.ts";
import type { OAuthClient } from "../clients.ts";
import { optionalParameter, requiredParameter } from "../oauth-parameters.ts";
import type { DiskOAuthStore } from "../storage/disk-store.ts";
import { issueTokenResponse, type TokenResponse } from "./token-response.ts";

export async function authorizationCodeGrant(config: ServiceConfig, store: DiskOAuthStore, client: OAuthClient, form: URLSearchParams): Promise<TokenResponse> {
  const code = requiredParameter(form, "code");
  const redirectUri = requiredParameter(form, "redirect_uri");
  const requestedResource = requiredParameter(form, "resource");
  const record = await store.consumeAuthorizationCode(code, optionalParameter(form, "code_verifier"), {
    clientId: client.clientId,
    redirectUri,
    resource: requestedResource,
    allowedResources: client.allowedResources,
    allowedScopes: client.allowedScopes,
  });
  const refreshToken = await store.createRefreshToken({
    clientId: client.clientId,
    resource: requestedResource,
    scopes: record.scopes,
    userSub: record.userSub,
    authTime: record.authTime,
    ttlSeconds: config.refreshTokenTtlSeconds,
  });
  return issueTokenResponse(config, {
    clientId: client.clientId,
    resource: requestedResource,
    scopes: record.scopes,
    refreshToken,
    authTime: record.authTime,
    nonce: record.nonce,
  });
}

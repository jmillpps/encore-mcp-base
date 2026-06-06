import type { ServiceConfig } from "../../shared/config.ts";
import type { OAuthClient } from "../clients.ts";
import { optionalParameter, requiredParameter } from "../oauth-parameters.ts";
import type { DiskOAuthStore } from "../storage/disk-store.ts";
import { issueTokenResponse, type TokenResponse } from "./token-response.ts";

export async function refreshTokenGrant(config: ServiceConfig, store: DiskOAuthStore, client: OAuthClient, form: URLSearchParams): Promise<TokenResponse> {
  const token = requiredParameter(form, "refresh_token");
  const rotated = await store.rotateRefreshToken(token, client.clientId, config.refreshTokenTtlSeconds, optionalParameter(form, "resource"), client.allowedResources);
  return issueTokenResponse(config, {
    clientId: client.clientId,
    resource: rotated.oldRecord.resource,
    scopes: rotated.oldRecord.scopes,
    refreshToken: rotated.newToken,
    authTime: rotated.oldRecord.authTime,
  });
}

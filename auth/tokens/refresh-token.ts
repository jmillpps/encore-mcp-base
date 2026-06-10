import type { ServiceConfig } from "../../shared/config.ts";
import type { OAuthClient } from "../clients.ts";
import { resolveOAuthGrantResource } from "../oauth-resource.ts";
import { optionalParameter, requiredParameter } from "../oauth-parameters.ts";
import type { OAuthStore } from "../storage/oauth-store.ts";
import { issueTokenResponse, type TokenResponse } from "./token-response.ts";

export async function refreshTokenGrant(config: ServiceConfig, store: OAuthStore, client: OAuthClient, form: URLSearchParams): Promise<TokenResponse> {
  const token = requiredParameter(form, "refresh_token");
  const resource = resolveOAuthGrantResource(client, optionalParameter(form, "resource"));
  const rotated = await store.rotateRefreshToken(token, client.clientId, config.refreshTokenTtlSeconds, resource, client.allowedResources);
  return issueTokenResponse(config, {
    clientId: client.clientId,
    resource: rotated.oldRecord.resource,
    scopes: rotated.oldRecord.scopes,
    refreshToken: rotated.newToken,
    authTime: rotated.oldRecord.authTime,
    user: rotated.oldRecord.user,
  });
}

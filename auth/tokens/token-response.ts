import type { ServiceConfig } from "../../shared/config.ts";
import { readStaticUser } from "../static-user.ts";
import { issueAccessToken } from "./access-token.ts";
import { issueIdToken } from "./id-token.ts";

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
}

export interface TokenResponseInput {
  clientId: string;
  resource: string;
  scopes: string[];
  refreshToken: string;
  authTime: number;
  nonce?: string;
}

export function issueTokenResponse(config: ServiceConfig, input: TokenResponseInput): TokenResponse {
  const user = readStaticUser();
  const response: TokenResponse = {
    access_token: issueAccessToken(config, { sub: user.sub, clientId: input.clientId, audience: input.resource, scopes: input.scopes }),
    token_type: "bearer",
    expires_in: config.accessTokenTtlSeconds,
    refresh_token: input.refreshToken,
    scope: input.scopes.join(" "),
  };
  if (input.scopes.includes("openid")) response.id_token = issueIdToken(config, user, input.clientId, input.authTime, input.nonce);
  return response;
}

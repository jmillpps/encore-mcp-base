import { APIError } from "encore.dev/api";
import { verifyBearer } from "../auth/bearer.ts";
import type { AccessTokenClaims } from "../auth/tokens/token-claims.ts";
import { ServiceError } from "../shared/errors.ts";
import { readConfig } from "../shared/config.ts";

export function verifyActionBearer(authorization: string, scopes: readonly string[]): AccessTokenClaims {
  try {
    const config = readConfig();
    return verifyBearer(config, authorization, config.actionsAudience, scopes);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 403) throw APIError.permissionDenied("insufficient scope");
    throw APIError.unauthenticated("invalid bearer token");
  }
}

export function rejectActionAccessTokenQuery(accessToken: string | undefined): void {
  if (accessToken !== undefined) throw APIError.invalidArgument("access tokens must use the authorization header");
}

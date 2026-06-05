import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { readAuthorizationCredentials } from "./authorization-header.ts";
import { verifyAccessToken } from "./tokens/access-token.ts";
import type { AccessTokenClaims } from "./tokens/token-claims.ts";

export function readBearer(header: string | undefined): string {
  return readAuthorizationCredentials(header, "Bearer", { code: "unauthorized", message: "missing bearer token", status: 401 });
}

export function verifyBearer(config: ServiceConfig, header: string | undefined, audience: string, scopes: string[] = []): AccessTokenClaims {
  return verifyAccessToken(config, readBearer(header), audience, scopes);
}

export function verifyBearerAnyAudience(config: ServiceConfig, header: string | undefined, audiences: string[], scopes: string[] = []): AccessTokenClaims {
  const token = readBearer(header);
  let scopeError: ServiceError | undefined;
  for (const audience of audiences) {
    try {
      return verifyAccessToken(config, token, audience, scopes);
    } catch (error) {
      if (error instanceof ServiceError && error.status === 403) scopeError = error;
      else if (!(error instanceof ServiceError) || error.status !== 401) throw error;
    }
  }
  if (scopeError) throw scopeError;
  throw new ServiceError("unauthorized", "invalid token", 401);
}

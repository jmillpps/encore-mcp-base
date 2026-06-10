import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { authorizationCredentials } from "./authorization-header.ts";
import { accessTokenError } from "./tokens/access-token-error.ts";
import { verifyAccessToken } from "./tokens/access-token.ts";
import type { AccessTokenClaims } from "./tokens/token-claims.ts";

export function readBearer(header: string | undefined): string {
  if (!header) throw accessTokenError("missing_authorization_header");
  const credentials = authorizationCredentials(header, "Bearer");
  if (credentials === undefined) throw accessTokenError("invalid_authorization_header");
  return credentials;
}

export function verifyBearer(config: ServiceConfig, header: string | undefined, audience: string, scopes: readonly string[] = []): AccessTokenClaims {
  return verifyAccessToken(config, readBearer(header), audience, scopes);
}

export function verifyPresentedBearer(config: ServiceConfig, header: string | undefined, audience: string): void {
  if (header === undefined || header === "") return;
  verifyAccessToken(config, readBearer(header), audience);
}

export function verifyBearerAnyAudience(config: ServiceConfig, header: string | undefined, audiences: readonly string[], scopes: readonly string[] = []): AccessTokenClaims {
  const token = readBearer(header);
  let scopeError: ServiceError | undefined;
  let tokenError: ServiceError | undefined;
  for (const audience of audiences) {
    try {
      return verifyAccessToken(config, token, audience, scopes);
    } catch (error) {
      if (error instanceof ServiceError && error.status === 403) scopeError = error;
      else if (error instanceof ServiceError && error.status === 401) tokenError ??= error;
      else throw error;
    }
  }
  if (scopeError) throw scopeError;
  throw tokenError ?? accessTokenError("audience_mismatch");
}

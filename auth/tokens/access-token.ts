import type { ServiceConfig } from "../../shared/config.ts";
import { randomToken } from "../../shared/crypto.ts";
import { ServiceError } from "../../shared/errors.ts";
import { nowSeconds } from "../../shared/time.ts";
import { hasScopes } from "../scopes.ts";
import type { UserProfile } from "../user-profile.ts";
import { accessTokenError } from "./access-token-error.ts";
import { getSigningKey, getVerificationKeys } from "./signing-keys.ts";
import { jwtKid, JwtValidationError, signJwt, verifyJwt } from "./jwt.ts";
import type { AccessTokenClaims } from "./token-claims.ts";

export interface AccessTokenInput {
  user: UserProfile;
  clientId: string;
  audience: string;
  scopes: string[];
}

export function issueAccessToken(config: ServiceConfig, input: AccessTokenInput): string {
  const now = nowSeconds();
  const key = getSigningKey(config);
  const claims: AccessTokenClaims = {
    iss: config.issuer,
    sub: input.user.sub,
    aud: input.audience,
    exp: now + config.accessTokenTtlSeconds,
    iat: now,
    nbf: now,
    jti: randomToken(18),
    client_id: input.clientId,
    scope: input.scopes.join(" "),
    name: input.user.name,
    given_name: input.user.given_name,
    family_name: input.user.family_name,
    preferred_username: input.user.preferred_username,
    email: input.user.email,
    email_verified: input.user.email_verified,
  };
  return signJwt({ ...claims }, key.kid, key.privateKey);
}

export function verifyAccessToken(config: ServiceConfig, token: string, audience: string, requiredScopes: readonly string[] = []): AccessTokenClaims {
  const kid = readKid(token);
  const key = getVerificationKeys(config).find((candidate) => candidate.kid === kid);
  if (!key) throw accessTokenError("unknown_key_id");
  const payload = readPayload(token, key.publicKey);
  const claims = accessClaims(payload);
  const now = nowSeconds();
  if (claims.iss !== config.issuer) throw accessTokenError("issuer_mismatch");
  if (claims.aud !== audience) throw accessTokenError("audience_mismatch");
  if (claims.exp <= now) throw accessTokenError("token_expired");
  if (claims.nbf > now) throw accessTokenError("token_not_yet_valid");
  if (claims.iat > now) throw accessTokenError("token_issued_in_future");
  if (!hasScopes(claims.scope.split(/\s+/).filter(Boolean), requiredScopes)) {
    throw accessTokenError("insufficient_scope", 403);
  }
  return claims;
}

function readKid(token: string): string {
  try {
    return jwtKid(token);
  } catch (error) {
    throw jwtAccessTokenError(error);
  }
}

function readPayload(token: string, publicKey: Parameters<typeof verifyJwt>[1]): Record<string, unknown> {
  try {
    return verifyJwt(token, publicKey);
  } catch (error) {
    throw jwtAccessTokenError(error);
  }
}

function jwtAccessTokenError(error: unknown): ServiceError {
  if (error instanceof JwtValidationError) return accessTokenError(error.reason);
  if (error instanceof ServiceError) return error;
  return accessTokenError("jwt_malformed");
}

function accessClaims(payload: Record<string, unknown>): AccessTokenClaims {
  const required = ["iss", "sub", "aud", "jti", "client_id", "scope", "name", "given_name", "family_name", "preferred_username", "email"];
  if (!required.every((key) => nonEmptyString(payload[key]))) throw accessTokenError("missing_required_claim");
  if (!validScopeString(payload.scope)) throw accessTokenError("invalid_scope_claim");
  if (typeof payload.email_verified !== "boolean") throw accessTokenError("invalid_email_verified_claim");
  if (!isNumericDate(payload.exp) || !isNumericDate(payload.iat) || !isNumericDate(payload.nbf)) {
    throw accessTokenError("invalid_numeric_date");
  }
  return payload as unknown as AccessTokenClaims;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value !== "";
}

function isNumericDate(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validScopeString(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() !== value) return false;
  return value.split(" ").every((scope) => /^[A-Za-z0-9:_./-]+$/.test(scope));
}

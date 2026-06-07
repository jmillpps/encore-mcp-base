import type { ServiceConfig } from "../../shared/config.ts";
import { randomToken } from "../../shared/crypto.ts";
import { ServiceError } from "../../shared/errors.ts";
import { nowSeconds } from "../../shared/time.ts";
import { hasScopes } from "../scopes.ts";
import { getSigningKey, getVerificationKeys } from "./signing-keys.ts";
import { jwtKid, signJwt, verifyJwt } from "./jwt.ts";
import type { AccessTokenClaims } from "./token-claims.ts";

export interface AccessTokenInput {
  sub: string;
  clientId: string;
  audience: string;
  scopes: string[];
}

export function issueAccessToken(config: ServiceConfig, input: AccessTokenInput): string {
  const now = nowSeconds();
  const key = getSigningKey(config);
  const claims: AccessTokenClaims = {
    iss: config.issuer,
    sub: input.sub,
    aud: input.audience,
    exp: now + config.accessTokenTtlSeconds,
    iat: now,
    nbf: now,
    jti: randomToken(18),
    client_id: input.clientId,
    scope: input.scopes.join(" "),
  };
  return signJwt({ ...claims }, key.kid, key.privateKey);
}

export function verifyAccessToken(config: ServiceConfig, token: string, audience: string, requiredScopes: readonly string[] = []): AccessTokenClaims {
  const kid = jwtKid(token);
  const key = getVerificationKeys(config).find((candidate) => candidate.kid === kid);
  if (!key) throw new ServiceError("unauthorized", "invalid token", 401);
  const payload = verifyJwt(token, key.publicKey);
  const claims = accessClaims(payload);
  const now = nowSeconds();
  if (claims.iss !== config.issuer || claims.aud !== audience || claims.exp <= now || claims.nbf > now || claims.iat > now) {
    throw new ServiceError("unauthorized", "invalid token", 401);
  }
  if (!hasScopes(claims.scope.split(/\s+/).filter(Boolean), requiredScopes)) {
    throw new ServiceError("forbidden", "insufficient scope", 403);
  }
  return claims;
}

function accessClaims(payload: Record<string, unknown>): AccessTokenClaims {
  const required = ["iss", "sub", "aud", "jti", "client_id", "scope"];
  if (!required.every((key) => nonEmptyString(payload[key]))) throw new ServiceError("unauthorized", "invalid token", 401);
  if (!validScopeString(payload.scope)) throw new ServiceError("unauthorized", "invalid token", 401);
  if (!isNumericDate(payload.exp) || !isNumericDate(payload.iat) || !isNumericDate(payload.nbf)) {
    throw new ServiceError("unauthorized", "invalid token", 401);
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

import type { ServiceConfig } from "../../shared/config.ts";
import { randomToken } from "../../shared/crypto.ts";
import { ServiceError } from "../../shared/errors.ts";
import { nowSeconds } from "../../shared/time.ts";
import { hasScopes } from "../scopes.ts";
import { getSigningKey } from "./signing-keys.ts";
import { signJwt, verifyJwt } from "./jwt.ts";
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

export function verifyAccessToken(config: ServiceConfig, token: string, audience: string, requiredScopes: string[] = []): AccessTokenClaims {
  const key = getSigningKey(config);
  const payload = verifyJwt(token, key.publicKey);
  const claims = accessClaims(payload);
  const now = nowSeconds();
  if (claims.iss !== config.issuer || claims.aud !== audience || claims.exp <= now || claims.nbf > now) {
    throw new ServiceError("unauthorized", "invalid token", 401);
  }
  if (!hasScopes(claims.scope.split(/\s+/).filter(Boolean), requiredScopes)) {
    throw new ServiceError("forbidden", "insufficient scope", 403);
  }
  return claims;
}

function accessClaims(payload: Record<string, unknown>): AccessTokenClaims {
  const required = ["iss", "sub", "aud", "jti", "client_id", "scope"];
  if (!required.every((key) => typeof payload[key] === "string")) throw new ServiceError("unauthorized", "invalid token", 401);
  if (typeof payload.exp !== "number" || typeof payload.iat !== "number" || typeof payload.nbf !== "number") {
    throw new ServiceError("unauthorized", "invalid token", 401);
  }
  return payload as unknown as AccessTokenClaims;
}

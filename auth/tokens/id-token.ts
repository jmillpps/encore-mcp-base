import type { ServiceConfig } from "../../shared/config.ts";
import { nowSeconds } from "../../shared/time.ts";
import type { StaticUser } from "../static-user.ts";
import { getSigningKey } from "./signing-keys.ts";
import { signJwt } from "./jwt.ts";
import type { IdTokenClaims } from "./token-claims.ts";

export function issueIdToken(config: ServiceConfig, user: StaticUser, clientId: string): string {
  const now = nowSeconds();
  const key = getSigningKey(config);
  const claims: IdTokenClaims = {
    iss: config.issuer,
    sub: user.sub,
    aud: clientId,
    exp: now + config.idTokenTtlSeconds,
    iat: now,
    auth_time: now,
    name: user.name,
    given_name: user.given_name,
    family_name: user.family_name,
    preferred_username: user.preferred_username,
    email: user.email,
    email_verified: user.email_verified,
  };
  return signJwt({ ...claims }, key.kid, key.privateKey);
}

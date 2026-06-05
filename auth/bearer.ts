import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { verifyAccessToken } from "./tokens/access-token.ts";
import type { AccessTokenClaims } from "./tokens/token-claims.ts";

export function readBearer(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) throw new ServiceError("unauthorized", "missing bearer token", 401);
  return header.slice("Bearer ".length).trim();
}

export function verifyBearer(config: ServiceConfig, header: string | undefined, audience: string, scopes: string[] = []): AccessTokenClaims {
  return verifyAccessToken(config, readBearer(header), audience, scopes);
}

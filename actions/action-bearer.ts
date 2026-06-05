import { APIError } from "encore.dev/api";
import { verifyBearer } from "../auth/bearer.ts";
import type { AccessTokenClaims } from "../auth/tokens/token-claims.ts";
import { readConfig } from "../shared/config.ts";

export function verifyActionBearer(authorization: string, scopes: string[]): AccessTokenClaims {
  try {
    const config = readConfig();
    return verifyBearer(config, authorization, config.actionsAudience, scopes);
  } catch {
    throw APIError.unauthenticated("invalid bearer token");
  }
}

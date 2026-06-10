import { createHash } from "node:crypto";
import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { nowSeconds } from "../shared/time.ts";
import { userProfileFromUpstream, type UserProfile } from "./user-profile.ts";
import type { JwsAlgorithm } from "./upstream-oidc-jwt.ts";

const clockSkewSeconds = 60;
const hashByAlgorithm: Record<JwsAlgorithm, string> = {
  RS256: "sha256",
  RS384: "sha384",
  RS512: "sha512",
  PS256: "sha256",
  PS384: "sha384",
  PS512: "sha512",
  ES256: "sha256",
  ES384: "sha384",
  ES512: "sha512",
};

export function validateUpstreamIdToken(
  config: ServiceConfig,
  payload: Record<string, unknown>,
  alg: JwsAlgorithm,
  upstreamNonce: string,
  accessToken: string,
): { sub: string } {
  if (payload.iss !== config.upstreamOidc.issuer) throw invalidGrant("upstream ID token issuer is invalid");
  if (!audienceIsOnlyClient(payload.aud, config.upstreamOidc.clientId)) throw invalidGrant("upstream ID token audience is invalid");
  const now = nowSeconds();
  if (seconds(payload.exp) <= now - clockSkewSeconds) throw invalidGrant("upstream ID token is expired");
  if (seconds(payload.iat) > now + clockSkewSeconds) throw invalidGrant("upstream ID token issued-at is invalid");
  if (payload.nbf !== undefined && seconds(payload.nbf) > now + clockSkewSeconds) throw invalidGrant("upstream ID token not-before is invalid");
  if (payload.nonce !== upstreamNonce) throw invalidGrant("upstream ID token nonce is invalid");
  if (payload.at_hash !== undefined && payload.at_hash !== accessTokenHash(accessToken, alg)) throw invalidGrant("upstream ID token access-token hash is invalid");
  return { sub: subject(payload.sub, "upstream ID token subject is invalid") };
}

export function validateUpstreamUserinfo(config: ServiceConfig, payload: Record<string, unknown>, idTokenSubject: string, signed: boolean): UserProfile {
  if (signed) {
    if (payload.iss !== config.upstreamOidc.issuer) throw invalidGrant("upstream userinfo issuer is invalid");
    if (!audienceIsOnlyClient(payload.aud, config.upstreamOidc.clientId)) throw invalidGrant("upstream userinfo audience is invalid");
  }
  if (subject(payload.sub, "upstream userinfo subject is invalid") !== idTokenSubject) throw invalidGrant("upstream userinfo subject mismatch");
  try {
    return userProfileFromUpstream(payload);
  } catch {
    throw invalidGrant("upstream userinfo response is invalid");
  }
}

function audienceIsOnlyClient(value: unknown, clientId: string): boolean {
  if (typeof value === "string") return value === clientId;
  if (!Array.isArray(value) || value.length !== 1) return false;
  return value[0] === clientId;
}

function seconds(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw invalidGrant("upstream token time claim is invalid");
  return value;
}

function subject(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > 256 || /[\r\n]/.test(value)) throw invalidGrant(message);
  return value;
}

function accessTokenHash(accessToken: string, alg: JwsAlgorithm): string {
  const digest = createHash(hashByAlgorithm[alg]).update(accessToken, "ascii").digest();
  return digest.subarray(0, digest.length / 2).toString("base64url");
}

function invalidGrant(message: string): ServiceError {
  return new ServiceError("invalid_grant", message, 400);
}

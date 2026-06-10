import { constants, createPublicKey, createVerify, type KeyObject, type webcrypto } from "node:crypto";
import { decodeJsonBase64Url } from "../shared/base64url.ts";
import { ServiceError } from "../shared/errors.ts";

export type JwsAlgorithm = "RS256" | "RS384" | "RS512" | "PS256" | "PS384" | "PS512" | "ES256" | "ES384" | "ES512";

export interface VerifiedJwt {
  header: { alg: JwsAlgorithm; kid: string };
  payload: Record<string, unknown>;
}

export interface JwksDocument {
  keys: Record<string, unknown>[];
}

const maxJwtLength = 16384;
const implementedAlgorithms = new Set<JwsAlgorithm>(["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512"]);
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
const pssSaltLength: Record<"PS256" | "PS384" | "PS512", number> = { PS256: 32, PS384: 48, PS512: 64 };

export function supportedAlgorithms(values: unknown): JwsAlgorithm[] {
  if (!Array.isArray(values)) throw invalidGrant("upstream discovery response is invalid");
  const result = values.filter((value): value is JwsAlgorithm => typeof value === "string" && implementedAlgorithms.has(value as JwsAlgorithm));
  if (result.length === 0) throw invalidGrant("upstream signing algorithms are unsupported");
  return result;
}

export function verifyJwt(token: string, jwks: JwksDocument, allowedAlgorithms: readonly JwsAlgorithm[]): VerifiedJwt {
  const [encodedHeader, encodedPayload, encodedSignature] = jwtParts(token);
  const header = jwtHeader(decodeJwtJson(encodedHeader), allowedAlgorithms);
  const key = selectKey(jwks, header);
  if (!verifySignature(key, header.alg, `${encodedHeader}.${encodedPayload}`, encodedSignature)) throw invalidGrant("upstream token signature is invalid");
  const payload = decodeJwtJson(encodedPayload);
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) throw invalidGrant("upstream token payload is invalid");
  return { header, payload: payload as Record<string, unknown> };
}

export function isCompactJwt(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part));
}

function jwtParts(token: string): [string, string, string] {
  if (token.length > maxJwtLength) throw invalidGrant("upstream token is invalid");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part === "")) throw invalidGrant("upstream token is invalid");
  return parts as [string, string, string];
}

function decodeJwtJson(input: string): unknown {
  try {
    return decodeJsonBase64Url(input);
  } catch {
    throw invalidGrant("upstream token is invalid");
  }
}

function jwtHeader(value: unknown, allowedAlgorithms: readonly JwsAlgorithm[]): { alg: JwsAlgorithm; kid: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalidGrant("upstream token header is invalid");
  const record = value as Record<string, unknown>;
  if (record.crit !== undefined || record.jku !== undefined || record.jwk !== undefined || record.x5u !== undefined || record.x5c !== undefined) {
    throw invalidGrant("upstream token header is invalid");
  }
  if (record.typ !== undefined && record.typ !== "JWT") throw invalidGrant("upstream token header is invalid");
  if (typeof record.alg !== "string" || !implementedAlgorithms.has(record.alg as JwsAlgorithm)) throw invalidGrant("upstream token algorithm is unsupported");
  if (!allowedAlgorithms.includes(record.alg as JwsAlgorithm)) throw invalidGrant("upstream token algorithm is unsupported");
  if (!safeKeyId(record.kid)) throw invalidGrant("upstream token key id is invalid");
  return { alg: record.alg as JwsAlgorithm, kid: record.kid };
}

function safeKeyId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\u0000-\u001F\u007F]/.test(value);
}

function selectKey(jwks: JwksDocument, header: { alg: JwsAlgorithm; kid: string }): KeyObject {
  const candidates = jwks.keys.filter((key) => key.kid === header.kid && keyMatchesAlgorithm(key, header.alg) && keyAllowsSignature(key));
  if (candidates.length !== 1) throw invalidGrant("upstream signing key is unavailable");
  const key = candidates[0];
  if (!key) throw invalidGrant("upstream signing key is unavailable");
  if (typeof key.alg === "string" && key.alg !== header.alg) throw invalidGrant("upstream signing key algorithm is invalid");
  try {
    return createPublicKey({ key: key as webcrypto.JsonWebKey, format: "jwk" });
  } catch {
    throw invalidGrant("upstream signing key is invalid");
  }
}

function keyMatchesAlgorithm(key: Record<string, unknown>, alg: JwsAlgorithm): boolean {
  if (alg.startsWith("RS") || alg.startsWith("PS")) return key.kty === "RSA";
  if (alg.startsWith("ES")) return key.kty === "EC";
  return false;
}

function keyAllowsSignature(key: Record<string, unknown>): boolean {
  if (key.use !== undefined && key.use !== "sig") return false;
  if (key.key_ops !== undefined) return Array.isArray(key.key_ops) && key.key_ops.includes("verify");
  return true;
}

function verifySignature(key: KeyObject, alg: JwsAlgorithm, signingInput: string, signature: string): boolean {
  try {
    const verifier = createVerify(hashByAlgorithm[alg]).update(signingInput).end();
    if (alg.startsWith("PS")) return verifier.verify({ key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: pssSaltLength[alg as "PS256" | "PS384" | "PS512"] }, signature, "base64url");
    if (alg.startsWith("RS")) return verifier.verify({ key, padding: constants.RSA_PKCS1_PADDING }, signature, "base64url");
    return verifier.verify({ key, dsaEncoding: "ieee-p1363" }, signature, "base64url");
  } catch {
    throw invalidGrant("upstream token signature is invalid");
  }
}

function invalidGrant(message: string): ServiceError {
  return new ServiceError("invalid_grant", message, 400);
}

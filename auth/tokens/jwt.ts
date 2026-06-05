import { createSign, createVerify, type KeyObject } from "node:crypto";
import { decodeJsonBase64Url, encodeJsonBase64Url } from "../../shared/base64url.ts";
import { ServiceError } from "../../shared/errors.ts";

export function signJwt(payload: Record<string, unknown>, kid: string, privateKey: KeyObject): string {
  const header = { alg: "RS256", kid, typ: "JWT" };
  const signingInput = `${encodeJsonBase64Url(header)}.${encodeJsonBase64Url(payload)}`;
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(privateKey, "base64url");
  return `${signingInput}.${signature}`;
}

export function verifyJwt(token: string, publicKey: KeyObject): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw invalidToken();
  const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];
  const header = decodeJwtJson(encodedHeader);
  if (!isHeader(header)) throw invalidToken();
  if (!verifySignature(publicKey, `${encodedHeader}.${encodedPayload}`, signature)) throw invalidToken();
  const payload = decodeJwtJson(encodedPayload);
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw invalidToken();
  }
  return payload as Record<string, unknown>;
}

export function jwtKid(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3) throw invalidToken();
  const [encodedHeader] = parts as [string, string, string];
  const header = decodeJwtJson(encodedHeader);
  if (!isHeader(header)) throw invalidToken();
  return header.kid;
}

function isHeader(value: unknown): value is { alg: "RS256"; kid: string } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (value as { alg?: unknown }).alg === "RS256" && typeof (value as { kid?: unknown }).kid === "string";
}

function decodeJwtJson(input: string): unknown {
  try {
    return decodeJsonBase64Url(input);
  } catch {
    throw invalidToken();
  }
}

function verifySignature(publicKey: KeyObject, signingInput: string, signature: string): boolean {
  try {
    return createVerify("RSA-SHA256").update(signingInput).end().verify(publicKey, signature, "base64url");
  } catch {
    throw invalidToken();
  }
}

function invalidToken(): never {
  throw new ServiceError("unauthorized", "invalid token", 401);
}

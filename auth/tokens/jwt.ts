import { createSign, createVerify, type KeyObject } from "node:crypto";
import { decodeJsonBase64Url, encodeJsonBase64Url } from "../../shared/base64url.ts";
import { ServiceError } from "../../shared/errors.ts";

const maxJwtLength = 8192;
const keyIdPattern = /^[A-Za-z0-9._-]{1,128}$/;

export function signJwt(payload: Record<string, unknown>, kid: string, privateKey: KeyObject): string {
  const header = { alg: "RS256", kid, typ: "JWT" };
  const signingInput = `${encodeJsonBase64Url(header)}.${encodeJsonBase64Url(payload)}`;
  const signature = createSign("RSA-SHA256").update(signingInput).end().sign(privateKey, "base64url");
  return `${signingInput}.${signature}`;
}

export function verifyJwt(token: string, publicKey: KeyObject): Record<string, unknown> {
  const [encodedHeader, encodedPayload, signature] = jwtParts(token);
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
  const [encodedHeader] = jwtParts(token);
  const header = decodeJwtJson(encodedHeader);
  if (!isHeader(header)) throw invalidToken();
  return header.kid;
}

function isHeader(value: unknown): value is { alg: "RS256"; kid: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.alg === "RS256" && typeof record.kid === "string" && keyIdPattern.test(record.kid) && (record.typ === undefined || record.typ === "JWT") && record.crit === undefined;
}

function jwtParts(token: string): [string, string, string] {
  if (token.length > maxJwtLength) throw invalidToken();
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part === "")) throw invalidToken();
  return parts as [string, string, string];
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

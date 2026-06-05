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
  if (parts.length !== 3) throw new ServiceError("unauthorized", "invalid token", 401);
  const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];
  const header = decodeJsonBase64Url(encodedHeader);
  if (!isHeader(header)) throw new ServiceError("unauthorized", "invalid token", 401);
  const ok = createVerify("RSA-SHA256").update(`${encodedHeader}.${encodedPayload}`).end().verify(publicKey, signature, "base64url");
  if (!ok) throw new ServiceError("unauthorized", "invalid token", 401);
  const payload = decodeJsonBase64Url(encodedPayload);
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new ServiceError("unauthorized", "invalid token", 401);
  }
  return payload as Record<string, unknown>;
}

function isHeader(value: unknown): value is { alg: "RS256" } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (value as { alg?: unknown }).alg === "RS256";
}

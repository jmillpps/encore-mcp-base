import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { encodeBase64Url } from "./base64url.ts";

export function randomToken(bytes = 32): string {
  return encodeBase64Url(randomBytes(bytes));
}

export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

export function constantTimeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    const max = Math.max(leftBuffer.length, rightBuffer.length, 1);
    timingSafeEqual(Buffer.alloc(max), Buffer.alloc(max));
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function s256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

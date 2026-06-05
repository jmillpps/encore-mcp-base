import { ServiceError } from "../shared/errors.ts";

const noncePattern = /^[A-Za-z0-9._~-]{8,256}$/;

export function isOidcNonce(value: string): boolean {
  return noncePattern.test(value);
}

export function oidcNonce(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!isOidcNonce(value)) throw new ServiceError("bad_request", "invalid nonce", 400);
  return value;
}

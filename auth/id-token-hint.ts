import { ServiceError } from "../shared/errors.ts";

const maxIdTokenHintLength = 4096;
const compactJwtPart = /^[A-Za-z0-9_-]+$/;

export function idTokenHint(value: string | undefined): void {
  if (value === undefined) return;
  if (!isCompactJwt(value)) throw new ServiceError("bad_request", "invalid id_token_hint", 400);
}

function isCompactJwt(value: string): boolean {
  if (value.length === 0 || value.length > maxIdTokenHintLength) return false;
  const parts = value.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0 && compactJwtPart.test(part));
}

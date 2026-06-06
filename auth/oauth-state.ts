import { ServiceError } from "../shared/errors.ts";

const maxStateLength = 512;
const controlPattern = /[\u0000-\u001F\u007F]/u;

export function oauthState(value: string | undefined): string {
  if (!value) throw new ServiceError("bad_request", "state is required", 400);
  if (value.length > maxStateLength || controlPattern.test(value)) {
    throw new ServiceError("bad_request", "state is invalid", 400);
  }
  return value;
}

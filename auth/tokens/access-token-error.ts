import { ServiceError } from "../../shared/errors.ts";

export type AccessTokenFailureReason =
  | "missing_authorization_header"
  | "invalid_authorization_header"
  | "jwt_oversized"
  | "jwt_malformed"
  | "jwt_invalid_header"
  | "jwt_invalid_signature"
  | "jwt_invalid_payload"
  | "unknown_key_id"
  | "issuer_mismatch"
  | "audience_mismatch"
  | "token_expired"
  | "token_not_yet_valid"
  | "token_issued_in_future"
  | "missing_required_claim"
  | "invalid_scope_claim"
  | "invalid_email_verified_claim"
  | "invalid_numeric_date"
  | "insufficient_scope";

export class AccessTokenValidationError extends ServiceError {
  readonly reason: AccessTokenFailureReason;

  constructor(reason: AccessTokenFailureReason, status = 401) {
    super(status === 403 ? "forbidden" : "unauthorized", status === 403 ? "insufficient scope" : "invalid token", status);
    this.reason = reason;
  }
}

export function accessTokenError(reason: AccessTokenFailureReason, status = 401): AccessTokenValidationError {
  return new AccessTokenValidationError(reason, status);
}

export function accessTokenFailureReason(error: unknown): AccessTokenFailureReason | "unknown_error" {
  if (error instanceof AccessTokenValidationError) return error.reason;
  if (error instanceof ServiceError && error.status === 403) return "insufficient_scope";
  return "unknown_error";
}

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_grant"
  | "invalid_client"
  | "invalid_scope"
  | "unsupported_grant_type"
  | "unsupported_response_type"
  | "rate_limited"
  | "server_error";

export class ServiceError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function badRequest(message: string): ServiceError {
  return new ServiceError("bad_request", message, 400);
}

export function unauthorized(message: string): ServiceError {
  return new ServiceError("unauthorized", message, 401);
}

export function forbidden(message: string): ServiceError {
  return new ServiceError("forbidden", message, 403);
}

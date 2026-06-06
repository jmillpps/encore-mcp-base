import type { ServerResponse } from "node:http";
import { emitDiagnostic } from "../shared/diagnostics.ts";
import type { ErrorCode } from "../shared/errors.ts";
import { ServiceError } from "../shared/errors.ts";
import { type ErrorContext, writeJson } from "../shared/http.ts";

export interface OAuthErrorBody {
  error: string;
  error_description: string;
}

export function oauthError(error: string, description: string): OAuthErrorBody {
  return { error, error_description: description };
}

export function writeOAuthError(res: ServerResponse, error: unknown, context?: ErrorContext): void {
  const headers = { "cache-control": "no-store", pragma: "no-cache" };
  if (error instanceof ServiceError) {
    emitDiagnostic(error.status >= 500 ? "error" : "warn", "oauth_error", {
      endpoint: context?.endpoint,
      method: context?.method,
      subject: context?.subject,
      status: error.status,
      code: error.code,
      ...context?.fields,
    });
    writeJson(res, error.status, oauthError(error.code, oauthErrorDescription(error.code)), headers);
    return;
  }
  emitDiagnostic("error", "oauth_unhandled_error", {
    endpoint: context?.endpoint,
    method: context?.method,
    subject: context?.subject,
    ...context?.fields,
  });
  writeJson(res, 500, oauthError("server_error", oauthErrorDescription("server_error")), headers);
}

function oauthErrorDescription(code: ErrorCode): string {
  switch (code) {
    case "invalid_client":
      return "client authentication failed";
    case "invalid_grant":
      return "grant is invalid";
    case "invalid_scope":
      return "scope is invalid";
    case "unsupported_grant_type":
      return "grant type is unsupported";
    case "unsupported_response_type":
      return "response type is unsupported";
    case "unauthorized":
      return "authorization required";
    case "forbidden":
      return "access denied";
    case "rate_limited":
      return "rate limit exceeded";
    case "server_error":
      return "server error";
    case "not_found":
      return "resource not found";
    case "bad_request":
      return "invalid request";
  }
}

import { accessTokenFailureReason } from "../auth/tokens/access-token-error.ts";
import { emitDiagnostic } from "../shared/diagnostics.ts";
import { ServiceError } from "../shared/errors.ts";

export interface ActionBearerContext {
  endpoint: string;
  method: string;
}

export function emitActionBearerDiagnostic(error: unknown, scopes: readonly string[], context: ActionBearerContext): void {
  emitDiagnostic("warn", "actions_bearer_validation_failed", {
    endpoint: context.endpoint,
    method: context.method,
    status: error instanceof ServiceError ? error.status : 500,
    code: error instanceof ServiceError ? error.code : "unknown",
    failureReason: accessTokenFailureReason(error),
    requiredScopes: [...scopes],
  });
}

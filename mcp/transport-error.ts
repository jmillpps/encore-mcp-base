import type { ServerResponse } from "node:http";
import { mcpProtectedResourceScopes } from "../auth/scopes.ts";
import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { type ErrorContext, writeError } from "../shared/http.ts";
import { wwwAuthenticate } from "./auth-challenge.ts";

export function writeMcpTransportError(config: ServiceConfig | undefined, res: ServerResponse, error: unknown, context: ErrorContext): void {
  if (config && error instanceof ServiceError && error.status === 401) {
    res.setHeader("www-authenticate", wwwAuthenticate(config, mcpProtectedResourceScopes(), error));
  }
  writeError(res, error, context);
}

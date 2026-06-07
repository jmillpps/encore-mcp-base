import { APIError, middleware } from "encore.dev/api";
import { hasMultipleAuthorizationValues } from "../auth/authorization-header.ts";

export const rejectDuplicateAuthorizationHeaders = middleware(
  { target: { expose: true, auth: true, isRaw: false } },
  async (req, next) => {
    const meta = req.requestMeta;
    if (meta?.type === "api-call" && hasMultipleAuthorizationValues(meta.headers)) {
      throw APIError.invalidArgument("duplicate authorization header");
    }
    return next(req);
  },
);

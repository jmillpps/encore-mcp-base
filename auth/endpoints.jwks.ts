import { api } from "encore.dev/api";
import { rejectAccessTokenQuery } from "../shared/access-token-query.ts";
import { readConfig } from "../shared/config.ts";
import { writeJson } from "../shared/http.ts";
import { writeOAuthError } from "./oauth-errors.ts";
import { jwks } from "./tokens/jwks.ts";

export const jwksEndpoint = api.raw({ expose: true, method: "GET", path: "/oauth/jwks" }, async (req, res) => {
  try {
    rejectAccessTokenQuery(req.url);
    writeJson(res, 200, jwks(readConfig()));
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.jwks", method: "GET" });
  }
});

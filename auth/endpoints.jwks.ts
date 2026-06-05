import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { writeJson } from "../shared/http.ts";
import { writeOAuthError } from "./oauth-errors.ts";
import { jwks } from "./tokens/jwks.ts";

export const jwksEndpoint = api.raw({ expose: true, method: "GET", path: "/oauth/jwks" }, async (_req, res) => {
  try {
    writeJson(res, 200, jwks(readConfig()));
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.jwks", method: "GET" });
  }
});

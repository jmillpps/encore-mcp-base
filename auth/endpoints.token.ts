import { api } from "encore.dev/api";
import { rejectAccessTokenQuery } from "../shared/access-token-query.ts";
import { readConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { readForm, requestSubject, writeJson } from "../shared/http.ts";
import { loadClients } from "./clients.ts";
import { writeOAuthError } from "./oauth-errors.ts";
import { enforceRateLimit, tokenRateSubject } from "./rate-limit.ts";
import { DiskOAuthStore } from "./storage/disk-store.ts";
import { handleTokenGrant } from "./token.ts";

export const token = api.raw({ expose: true, method: "POST", path: "/oauth/token" }, async (req, res) => {
  try {
    const config = readConfig();
    rejectAccessTokenQuery(req.url);
    const form = await readForm(req);
    const authorization = String(req.headers.authorization ?? "");
    await enforceRateLimit(config, "oauth-token", tokenRateSubject(form, authorization, requestSubject(req)));
    const body = await handleTokenGrant(
      config,
      new DiskOAuthStore(config.oauthStorePath),
      loadClients(config),
      form,
      authorization,
    );
    writeJson(res, 200, body, { "cache-control": "no-store", pragma: "no-cache" });
  } catch (error) {
    if (usesBasicAuthorization(req.headers.authorization) && error instanceof ServiceError && error.code === "invalid_client") {
      res.setHeader("www-authenticate", 'Basic realm="oauth"');
    }
    writeOAuthError(res, error, { endpoint: "oauth.token", method: "POST", subject: requestSubject(req) });
  }
});

function usesBasicAuthorization(value: unknown): boolean {
  return typeof value === "string" && /^Basic[ \t]/i.test(value);
}

import { api } from "encore.dev/api";
import { rejectAccessTokenQuery } from "../shared/access-token-query.ts";
import { readConfig } from "../shared/config.ts";
import { requestSubject, writeJson } from "../shared/http.ts";
import { verifyBearerAnyAudience } from "./bearer.ts";
import { writeOAuthError } from "./oauth-errors.ts";
import { enforceRateLimit } from "./rate-limit.ts";
import { staticUser } from "./static-user.ts";

export const userinfo = api.raw({ expose: true, method: "GET", path: "/oauth/userinfo" }, async (req, res) => {
  try {
    const config = readConfig();
    rejectAccessTokenQuery(req.url);
    await enforceRateLimit(config, "oauth-userinfo", requestSubject(req));
    verifyBearerAnyAudience(config, String(req.headers.authorization ?? ""), [config.actionsAudience, config.mcpResource], ["openid"]);
    writeJson(res, 200, staticUser, { "cache-control": "no-store", pragma: "no-cache" });
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.userinfo", method: "GET", subject: requestSubject(req) });
  }
});

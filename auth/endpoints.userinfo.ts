import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { requestSubject, writeError, writeJson } from "../shared/http.ts";
import { verifyBearerAnyAudience } from "./bearer.ts";
import { enforceRateLimit } from "./rate-limit.ts";
import { staticUser } from "./static-user.ts";

export const userinfo = api.raw({ expose: true, method: "GET", path: "/oauth/userinfo" }, async (req, res) => {
  try {
    const config = readConfig();
    await enforceRateLimit(config, "oauth-userinfo", requestSubject(req));
    verifyBearerAnyAudience(config, String(req.headers.authorization ?? ""), [config.actionsAudience, config.mcpResource], ["openid"]);
    writeJson(res, 200, staticUser);
  } catch (error) {
    writeError(res, error);
  }
});

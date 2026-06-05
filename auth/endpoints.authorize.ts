import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { requestSubject, writeError, writeRedirect } from "../shared/http.ts";
import { createAuthorizationRedirect } from "./authorize.ts";
import { loadClients } from "./clients.ts";
import { clientRateSubject, enforceRateLimit } from "./rate-limit.ts";
import { DiskOAuthStore } from "./storage/disk-store.ts";

export const authorize = api.raw({ expose: true, method: "GET", path: "/oauth/authorize" }, async (req, res) => {
  try {
    const config = readConfig();
    const url = new URL(req.url ?? "", config.issuer);
    await enforceRateLimit(config, "oauth-authorize", clientRateSubject(url.searchParams.get("client_id"), requestSubject(req)));
    const request = {
      responseType: url.searchParams.get("response_type") ?? "",
      clientId: url.searchParams.get("client_id") ?? "",
      redirectUri: url.searchParams.get("redirect_uri") ?? "",
      ...(url.searchParams.has("scope") ? { scope: url.searchParams.get("scope") ?? "" } : {}),
      ...(url.searchParams.has("state") ? { state: url.searchParams.get("state") ?? "" } : {}),
      ...(url.searchParams.has("resource") ? { resource: url.searchParams.get("resource") ?? "" } : {}),
      ...(url.searchParams.has("code_challenge") ? { codeChallenge: url.searchParams.get("code_challenge") ?? "" } : {}),
      ...(url.searchParams.has("code_challenge_method") ? { codeChallengeMethod: url.searchParams.get("code_challenge_method") ?? "" } : {}),
    };
    const redirect = await createAuthorizationRedirect(config, new DiskOAuthStore(config.oauthStorePath), loadClients(config), request);
    writeRedirect(res, redirect);
  } catch (error) {
    writeError(res, error, { endpoint: "oauth.authorize", method: "GET", subject: requestSubject(req) });
  }
});

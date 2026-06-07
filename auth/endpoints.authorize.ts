import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { requestSubject, writeRedirect } from "../shared/http.ts";
import { createAuthorizationRedirect } from "./authorize.ts";
import { loadClients } from "./clients.ts";
import { writeOAuthError } from "./oauth-errors.ts";
import { assertAllowedParameters, optionalParameter, requiredParameter } from "./oauth-parameters.ts";
import { clientRateSubject, enforceRateLimit } from "./rate-limit.ts";
import { DiskOAuthStore } from "./storage/disk-store.ts";

export const authorize = api.raw({ expose: true, method: "GET", path: "/oauth/authorize" }, async (req, res) => {
  try {
    const config = readConfig();
    const url = new URL(req.url ?? "", config.issuer);
    await enforceRateLimit(config, "oauth-authorize", clientRateSubject(url.searchParams.get("client_id"), requestSubject(req)));
    assertAllowedParameters(url.searchParams, [
      "response_type",
      "client_id",
      "redirect_uri",
      "scope",
      "state",
      "resource",
      "code_challenge",
      "code_challenge_method",
      "nonce",
      "id_token_hint",
    ]);
    const request = {
      responseType: requiredParameter(url.searchParams, "response_type"),
      clientId: requiredParameter(url.searchParams, "client_id"),
      redirectUri: requiredParameter(url.searchParams, "redirect_uri"),
      ...(url.searchParams.has("scope") ? { scope: optionalParameter(url.searchParams, "scope") ?? "" } : {}),
      ...(url.searchParams.has("state") ? { state: optionalParameter(url.searchParams, "state") ?? "" } : {}),
      ...(url.searchParams.has("resource") ? { resource: optionalParameter(url.searchParams, "resource") ?? "" } : {}),
      ...(url.searchParams.has("code_challenge") ? { codeChallenge: optionalParameter(url.searchParams, "code_challenge") ?? "" } : {}),
      ...(url.searchParams.has("code_challenge_method") ? { codeChallengeMethod: optionalParameter(url.searchParams, "code_challenge_method") ?? "" } : {}),
      ...(url.searchParams.has("nonce") ? { nonce: optionalParameter(url.searchParams, "nonce") ?? "" } : {}),
      ...(url.searchParams.has("id_token_hint") ? { idTokenHint: optionalParameter(url.searchParams, "id_token_hint") ?? "" } : {}),
    };
    const redirect = await createAuthorizationRedirect(config, new DiskOAuthStore(config.oauthStorePath), loadClients(config), request);
    writeRedirect(res, redirect);
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.authorize", method: "GET", subject: requestSubject(req) });
  }
});

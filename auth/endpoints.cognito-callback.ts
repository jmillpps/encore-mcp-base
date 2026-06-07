import { api } from "encore.dev/api";
import { rejectAccessTokenQuery } from "../shared/access-token-query.ts";
import { readConfig } from "../shared/config.ts";
import { requestSubject, writeRedirect } from "../shared/http.ts";
import { assertCognitoEnabled, createServiceAuthorizationCode } from "./cognito-authorization.ts";
import { exchangeCognitoCode } from "./cognito-client.ts";
import { writeOAuthError } from "./oauth-errors.ts";
import { assertAllowedParameters, optionalParameter, requiredParameter } from "./oauth-parameters.ts";
import { enforceRateLimit } from "./rate-limit.ts";
import { DiskOAuthStore } from "./storage/disk-store.ts";

export const cognitoCallback = api.raw({ expose: true, method: "GET", path: "/oauth/cognito/callback" }, async (req, res) => {
  try {
    rejectAccessTokenQuery(req.url);
    const config = readConfig();
    assertCognitoEnabled(config);
    const url = new URL(req.url ?? "", config.issuer);
    await enforceRateLimit(config, "oauth-authorize", requestSubject(req));
    assertAllowedParameters(url.searchParams, ["code", "state", "error", "error_description"]);
    const state = requiredParameter(url.searchParams, "state");
    const store = new DiskOAuthStore(config.oauthStorePath);
    const authorization = await store.consumeUpstreamAuthorizationState(state);
    const upstreamError = optionalParameter(url.searchParams, "error");
    if (upstreamError) {
      const redirect = new URL(authorization.redirectUri);
      redirect.searchParams.set("error", "access_denied");
      redirect.searchParams.set("state", authorization.clientState);
      writeRedirect(res, redirect.toString());
      return;
    }
    const code = requiredParameter(url.searchParams, "code");
    const user = await exchangeCognitoCode(config.cognito, code, authorization.codeVerifier);
    writeRedirect(res, await createServiceAuthorizationCode(config, store, authorization, user));
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.cognito.callback", method: "GET", subject: requestSubject(req) });
  }
});

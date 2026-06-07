import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { assertClientAuthMethod, assertClientSecret, type OAuthClient } from "./clients.ts";
import { assertPrivateKeyJwtClientAssertion } from "./client-assertion.ts";
import { readClientCredentials } from "./client-auth.ts";
import { resolveClient } from "./client-resolver.ts";
import { assertAllowedParameters, optionalParameter } from "./oauth-parameters.ts";
import type { DiskOAuthStore } from "./storage/disk-store.ts";
import { authorizationCodeGrant } from "./tokens/authorization-code.ts";
import { refreshTokenGrant } from "./tokens/refresh-token.ts";
import type { TokenResponse } from "./tokens/token-response.ts";

export type { TokenResponse } from "./tokens/token-response.ts";

export async function handleTokenGrant(
  config: ServiceConfig,
  store: DiskOAuthStore,
  clients: readonly OAuthClient[],
  form: URLSearchParams,
  authorization: string | undefined,
): Promise<TokenResponse> {
  assertAllowedParameters(form, ["grant_type", "client_id", "client_secret", "client_assertion_type", "client_assertion", "code", "redirect_uri", "code_verifier", "resource", "refresh_token"]);
  const grant = optionalParameter(form, "grant_type");
  assertAllowedParameters(form, tokenGrantParameters(grant));
  const credentials = readClientCredentials(form, authorization);
  const client = await resolveClient(config, clients, credentials.clientId);
  assertClientAuthMethod(client, credentials.method);
  if (credentials.method === "client_secret_post" || credentials.method === "client_secret_basic") assertClientSecret(client, credentials.clientSecret);
  if (credentials.method === "private_key_jwt") await assertPrivateKeyJwtClientAssertion(config, client, credentials.clientAssertion);
  if (grant === "authorization_code") return authorizationCodeGrant(config, store, client, form);
  if (grant === "refresh_token") return refreshTokenGrant(config, store, client, form);
  throw new ServiceError("unsupported_grant_type", "unsupported grant_type", 400);
}

function tokenGrantParameters(grant: string | undefined): string[] {
  const authParameters = ["client_id", "client_secret", "client_assertion_type", "client_assertion"];
  if (grant === "authorization_code") return ["grant_type", ...authParameters, "code", "redirect_uri", "code_verifier", "resource"];
  if (grant === "refresh_token") return ["grant_type", ...authParameters, "refresh_token", "resource"];
  return ["grant_type", ...authParameters];
}

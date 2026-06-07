import type { ServiceConfig } from "../shared/config.ts";
import { randomToken, s256Challenge } from "../shared/crypto.ts";
import { ServiceError } from "../shared/errors.ts";
import { readStaticUser, type StaticUser } from "./static-user.ts";
import type { DiskOAuthStore } from "./storage/disk-store.ts";
import type { UpstreamAuthorizationStateRecord } from "./storage/store-records.ts";

export interface ValidatedAuthorization {
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  clientState: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
}

export async function createLoginRedirect(config: ServiceConfig, store: DiskOAuthStore, request: ValidatedAuthorization): Promise<string> {
  if (!config.cognito.enabled) return createServiceAuthorizationCode(config, store, request, readStaticUser());
  const codeVerifier = randomToken(32);
  const state = await store.createUpstreamAuthorizationState({
    ...request,
    codeVerifier,
    ttlSeconds: config.authorizationCodeTtlSeconds,
  });
  const url = new URL(config.cognito.authorizationUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.cognito.clientId);
  url.searchParams.set("redirect_uri", config.cognito.redirectUri);
  url.searchParams.set("scope", config.cognito.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", s256Challenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function createServiceAuthorizationCode(
  config: ServiceConfig,
  store: DiskOAuthStore,
  request: ValidatedAuthorization | UpstreamAuthorizationStateRecord,
  user: StaticUser,
): Promise<string> {
  const code = await store.createAuthorizationCode({
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    resource: request.resource,
    scopes: request.scopes,
    user,
    ttlSeconds: config.authorizationCodeTtlSeconds,
    ...(request.nonce ? { nonce: request.nonce } : {}),
    ...(request.codeChallenge ? { codeChallenge: request.codeChallenge } : {}),
    ...(request.codeChallengeMethod ? { codeChallengeMethod: request.codeChallengeMethod } : {}),
  });
  const redirect = new URL(request.redirectUri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", request.clientState);
  return redirect.toString();
}

export function assertCognitoEnabled(config: ServiceConfig): void {
  if (!config.cognito.enabled) throw new ServiceError("bad_request", "upstream login is disabled", 400);
}

import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { DiskOAuthStore } from "./storage/disk-store.ts";
import { assertAllowedScopes, parseScopes } from "./scopes.ts";
import { assertRedirectUri, type OAuthClient } from "./clients.ts";
import { resolveClient } from "./client-resolver.ts";
import { idTokenHint } from "./id-token-hint.ts";
import { oidcNonce } from "./nonce.ts";
import { resolveOAuthAuthorizationResource } from "./oauth-resource.ts";
import { oauthState } from "./oauth-state.ts";
import { pkceInput } from "./pkce.ts";
import { readStaticUser } from "./static-user.ts";

export interface AuthorizationRequest {
  responseType: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
  resource?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  nonce?: string;
  idTokenHint?: string;
}

export async function createAuthorizationRedirect(
  config: ServiceConfig,
  store: DiskOAuthStore,
  clients: readonly OAuthClient[],
  request: AuthorizationRequest,
): Promise<string> {
  if (request.responseType !== "code") throw new ServiceError("unsupported_response_type", "unsupported response_type", 400);
  const state = oauthState(request.state);
  idTokenHint(request.idTokenHint);
  const client = await resolveClient(config, clients, request.clientId);
  assertRedirectUri(client, request.redirectUri);
  const resource = resolveOAuthAuthorizationResource(client, request.resource);
  const scopes = parseScopes(request.scope);
  assertAllowedScopes(scopes, client.allowedScopes);
  const pkce = pkceInput(client.pkcePolicy, request.codeChallenge, request.codeChallengeMethod);
  const nonce = oidcNonce(request.nonce);
  const user = readStaticUser();
  const code = await store.createAuthorizationCode({
    clientId: client.clientId,
    redirectUri: request.redirectUri,
    resource,
    scopes,
    userSub: user.sub,
    ttlSeconds: config.authorizationCodeTtlSeconds,
    ...pkce,
    ...(nonce ? { nonce } : {}),
  });
  const redirect = new URL(request.redirectUri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", state);
  return redirect.toString();
}

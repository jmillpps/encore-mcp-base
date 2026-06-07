import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { DiskOAuthStore } from "./storage/disk-store.ts";
import { assertAllowedScopes, parseScopes } from "./scopes.ts";
import { assertRedirectUri, assertResource, type OAuthClient } from "./clients.ts";
import { resolveClient } from "./client-resolver.ts";
import { oidcNonce } from "./nonce.ts";
import { oauthState } from "./oauth-state.ts";
import { pkceInput } from "./pkce.ts";
import { staticUser } from "./static-user.ts";

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
}

export async function createAuthorizationRedirect(
  config: ServiceConfig,
  store: DiskOAuthStore,
  clients: readonly OAuthClient[],
  request: AuthorizationRequest,
): Promise<string> {
  if (request.responseType !== "code") throw new ServiceError("unsupported_response_type", "unsupported response_type", 400);
  const state = oauthState(request.state);
  const client = await resolveClient(config, clients, request.clientId);
  assertRedirectUri(client, request.redirectUri);
  if (!request.resource) throw new ServiceError("bad_request", "resource is required", 400);
  const resource = request.resource;
  assertResource(client, resource);
  const scopes = parseScopes(request.scope);
  assertAllowedScopes(scopes, client.allowedScopes);
  const pkce = pkceInput(client.pkcePolicy, request.codeChallenge, request.codeChallengeMethod);
  const nonce = oidcNonce(request.nonce);
  const code = await store.createAuthorizationCode({
    clientId: client.clientId,
    redirectUri: request.redirectUri,
    resource,
    scopes,
    userSub: staticUser.sub,
    ttlSeconds: config.authorizationCodeTtlSeconds,
    ...pkce,
    ...(nonce ? { nonce } : {}),
  });
  const redirect = new URL(request.redirectUri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", state);
  return redirect.toString();
}

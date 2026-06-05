import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { DiskOAuthStore } from "./storage/disk-store.ts";
import { assertAllowedScopes, parseScopes } from "./scopes.ts";
import { assertRedirectUri, assertResource, findClient, type OAuthClient } from "./clients.ts";
import { oidcNonce } from "./nonce.ts";
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
  if (request.responseType !== "code") throw new ServiceError("bad_request", "unsupported response_type", 400);
  if (!request.state) throw new ServiceError("bad_request", "state is required", 400);
  const client = findClient(clients, request.clientId);
  assertRedirectUri(client, request.redirectUri);
  const resource = request.resource ?? config.actionsAudience;
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
  redirect.searchParams.set("state", request.state);
  return redirect.toString();
}

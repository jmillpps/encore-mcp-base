# OAuth Provider Architecture

The service acts as a private OAuth and OIDC provider for configured GPT clients. It supports authorization code flow, upstream OIDC login, refresh tokens, signed access tokens, ID tokens, userinfo, JWKS, discovery metadata, static clients, and Client ID Metadata Document clients.

## Client Types

Local development clients include:

| Client | Class | Resource access |
| --- | --- | --- |
| `local-test` | `local-test` | Actions and MCP resources. |
| `gpt-actions` | `gpt-actions` | Actions audience. |
| `gpt-apps-mcp` | `gpt-apps-mcp` | MCP resource. |

Production uses `OAUTH_CLIENTS_JSON`. URL-shaped client IDs are resolved as Client ID Metadata Documents.

Static registry clients provide exact redirect URIs, allowed scopes, allowed resources, client authentication method, PKCE policy, and client class. Metadata-document clients provide client identity material through a fetched metadata document.

## Resource Binding

Access tokens use the resolved OAuth resource value as the `aud` claim.

MCP clients include `resource` during authorization, code exchange, and refresh. Local multi-resource clients also include `resource`.

GPT Actions clients may omit `resource` when the client has one allowed resource and `clientClass` is `gpt-actions`. The service binds that omitted value to the configured Actions audience.

## Scopes

Default scopes are:

- `openid`
- `profile`
- `email`

The client registry controls allowed scopes per client. Token grants reject scopes outside the current client policy.

Authorization accepts ChatGPT locale hints and keeps policy decisions tied to validated OAuth fields.

## Token Handling

Access tokens and ID tokens are signed with RS256. ID tokens and profile endpoints return the user profile bound to the authorization grant. Refresh tokens rotate on use. Reuse of an older refresh token revokes the token family.

Authorization codes, upstream login states, and refresh tokens are stored as SHA-256 hashes. Token grant failures preserve valid authorization codes and refresh tokens when no consuming step completed.

## Upstream OIDC Login

`/oauth/authorize` validates the GPT client request and stores an upstream login state. The service redirects the browser to the configured upstream identity provider with PKCE. `/oauth/callback` consumes the upstream state once, exchanges the upstream authorization code, reads upstream userinfo, then issues the service authorization code to the original GPT redirect URI.

The callback is owned by the service origin. Users authenticate against the configured upstream identity provider. The service uses upstream userinfo claims for the issued ID token, userinfo response, MCP profile tool, and Actions profile endpoint.

Required upstream userinfo claims are `sub`, `email`, and `email_verified`. Optional display claims are normalized into the service identity profile.

## Client Authentication

Static clients support `client_secret_post` and `client_secret_basic`. Metadata-document clients support `none` and `private_key_jwt`.

`private_key_jwt` clients publish a same-origin JWKS. The service verifies assertion signature, issuer, subject, audience, expiration, time bounds, and `jti` replay status.

## Discovery

The service publishes:

- `/.well-known/openid-configuration`
- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-protected-resource/mcp`
- `/oauth/jwks`

Protected resource metadata advertises the MCP resource, the authorization server, supported scopes, and header bearer token use.

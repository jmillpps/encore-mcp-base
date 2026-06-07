# OAuth API Reference

The service implements private OAuth and OIDC endpoints for GPT account linking and token validation.

## Defaults

| Item | Value |
| --- | --- |
| Response type | `code` |
| Default scopes | `openid profile email` |
| Code challenge method | `S256` |
| Token signing algorithm | `RS256` |
| Subject type | public |
| Token bearer method | header |

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/oauth/authorize` | client request parameters | Authorization code request. |
| `GET` | `/oauth/cognito/callback` | Cognito callback parameters | Upstream login callback. |
| `POST` | `/oauth/token` | client authentication | Authorization code and refresh token grants. |
| `GET` | `/oauth/userinfo` | bearer token with `openid` | OIDC userinfo. |
| `GET` | `/oauth/jwks` | none | Public signing keys. |
| `GET` | `/.well-known/openid-configuration` | none | OIDC discovery. |
| `GET` | `/.well-known/oauth-authorization-server` | none | OAuth authorization server metadata. |
| `GET` | `/.well-known/oauth-protected-resource` | none | Protected resource metadata. |
| `GET` | `/.well-known/oauth-protected-resource/mcp` | none | MCP protected resource metadata. |

## Authorization Request

Required parameters:

| Parameter | Type | Rule |
| --- | --- | --- |
| `response_type` | string | Must be `code`. |
| `client_id` | string | Registered client ID or metadata document URL. |
| `redirect_uri` | URL | Exact registered redirect URI. |

Optional parameters:

| Parameter | Type | Rule |
| --- | --- | --- |
| `scope` | string | Space-separated scopes. Defaults to `openid profile email`. |
| `state` | string | Client state value returned to the redirect URI. |
| `resource` | URL | Audience resource for issued access tokens. |
| `code_challenge` | string | PKCE challenge. |
| `code_challenge_method` | string | Must be `S256` when provided. |
| `nonce` | string | OIDC nonce stored in the ID token. |
| `id_token_hint` | JWT | Reauthorization hint with syntax validation. |

The endpoint rejects duplicate parameters, unsupported parameters, query access tokens, unregistered redirect URIs, unknown clients, unsupported scopes, and unapproved resources.

Successful local authorization returns a redirect to the registered `redirect_uri` with `code` and optional `state`. Cognito-enabled authorization redirects to Cognito first, then returns the service code after Cognito callback processing.

## Token Grants

Supported grant types:

- `authorization_code`
- `refresh_token`

## Token Request

Requests use `application/x-www-form-urlencoded`.

Authorization code grants accept:

| Parameter | Required | Rule |
| --- | --- | --- |
| `grant_type` | yes | `authorization_code` |
| `client_id` | depends on client auth | Client ID for post body or public methods. |
| `client_secret` | depends on client auth | Required for `client_secret_post`. |
| `client_assertion_type` | depends on client auth | Required for `private_key_jwt`. |
| `client_assertion` | depends on client auth | JWT client assertion. |
| `code` | yes | Authorization code returned by `/oauth/authorize`. |
| `redirect_uri` | yes | Same redirect URI used for authorization. |
| `code_verifier` | depends on PKCE policy | PKCE verifier for challenged codes. |
| `resource` | depends on client policy | Audience resource. |

Refresh grants accept:

| Parameter | Required | Rule |
| --- | --- | --- |
| `grant_type` | yes | `refresh_token` |
| `client_id` | depends on client auth | Client ID for post body or public methods. |
| `client_secret` | depends on client auth | Required for `client_secret_post`. |
| `client_assertion_type` | depends on client auth | Required for `private_key_jwt`. |
| `client_assertion` | depends on client auth | JWT client assertion. |
| `refresh_token` | yes | Current refresh token. |
| `resource` | depends on client policy | Audience resource. |

Supported client authentication methods:

- `client_secret_post`
- `client_secret_basic`
- `none`
- `private_key_jwt`

Failed `client_secret_basic` requests return `WWW-Authenticate: Basic realm="oauth"` with `invalid_client`.

## Token Response

Status `200` returns:

| Field | Type | Description |
| --- | --- | --- |
| `access_token` | string | RS256 JWT access token. |
| `token_type` | string | Fixed value `bearer`. |
| `expires_in` | number | Access token lifetime in seconds. |
| `refresh_token` | string | Rotated refresh token. |
| `id_token` | string | RS256 JWT ID token when `openid` is granted. |
| `scope` | string | Granted scopes separated by spaces. |

## Token Claims

Access tokens include issuer, subject, audience, expiration, issued-at time, not-before time, JWT ID, client ID, scopes, and profile claims. The `aud` claim is the resolved OAuth resource.

ID tokens include the grant-bound user profile, client audience, authentication time, and nonce when the authorization request supplied one.

## Userinfo Response

`GET /oauth/userinfo` accepts Actions and MCP audience tokens with `openid`. Status `200` returns the profile bound to the access token.

## Discovery Metadata

Discovery documents publish endpoint URLs, supported response types, grant types, token endpoint auth methods, PKCE methods, scopes, and claims.

Protected resource metadata publishes:

| Field | Type | Description |
| --- | --- | --- |
| `resource` | string | MCP resource URL. |
| `resource_name` | string | Service title. |
| `authorization_servers` | string[] | Issuer URLs. |
| `scopes_supported` | string[] | MCP protected resource scopes. |
| `bearer_methods_supported` | string[] | Fixed value `header`. |

## Error Shape

OAuth errors return JSON:

| Field | Type | Description |
| --- | --- | --- |
| `error` | string | OAuth error code. |
| `error_description` | string | Safe caller-facing description. |

Common codes include `invalid_request`, `invalid_client`, `invalid_grant`, `invalid_scope`, `invalid_target`, `unsupported_grant_type`, and `server_error`.

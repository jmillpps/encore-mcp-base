# OAuth

The service acts as a private OAuth and OIDC provider for configured GPT clients.

The implementation supports authorization code flow, refresh tokens, signed access tokens, OIDC ID tokens, userinfo, JWKS, discovery metadata, exact redirect matching, scope enforcement, resource-bound access tokens, preregistered clients, and Client ID Metadata Document clients.

OAuth state is stored durably on disk. The store keeps hashes for authorization codes and refresh tokens. Raw secrets and raw bearer tokens are not stored.

The default local scopes are `openid`, `profile`, and `email`.

The default local MCP resource is `http://localhost:4000/mcp`.

The client registry controls allowed scopes and allowed audiences per GPT client.

MCP clients include `resource` in authorization requests, authorization-code exchanges, and refresh-token exchanges.

The service rejects missing `resource` values for MCP clients, Client ID Metadata Document clients, and local multi-resource clients.

Registered GPT Actions clients may omit `resource` in authorization requests, authorization-code exchanges, and refresh-token exchanges.

The service binds omitted GPT Actions resources to the client's configured Actions audience.

The GPT Actions client must have exactly one allowed audience when `resource` is omitted.

Issued access tokens use the resolved `resource` value as the token audience.

Discovery metadata advertises the union of configured client scopes.

Authorization server metadata advertises Client ID Metadata Document support through `client_id_metadata_document_supported`.

URL client IDs are resolved as Client ID Metadata Documents.

Metadata documents must contain `client_id`, `client_name`, and `redirect_uris`.

The metadata `client_id` value must match the document URL exactly.

Metadata-document clients use `token_endpoint_auth_method` value `none`.

Metadata-document clients always require PKCE.

Metadata-document clients receive the default `openid`, `profile`, and `email` scopes and the MCP resource audience.

Confidential token authentication is rejected for metadata-document clients.

OIDC discovery metadata advertises the ID token and profile claims supported by the service.

Protected resource metadata advertises the scopes configured for clients that can use the MCP resource.

Protected resource metadata is served at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`.

Authorization requests may include an OIDC nonce. The service validates nonce syntax, stores the nonce with the authorization code, and places the nonce in the ID token issued during code exchange.

ID token `auth_time` reflects the authorization request time and remains stable across refresh token rotation.

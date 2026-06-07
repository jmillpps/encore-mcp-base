# OAuth

The service acts as a private OAuth and OIDC provider for configured GPT clients.

The implementation supports authorization code flow, refresh tokens, signed access tokens, OIDC ID tokens, userinfo, JWKS, discovery metadata, exact redirect matching, scope enforcement, resource-bound access tokens, preregistered clients, and Client ID Metadata Document clients.

OAuth state is stored durably on disk. The store keeps hashes for authorization codes and refresh tokens. Raw secrets and raw bearer tokens are not stored.

The default local scopes are `openid`, `profile`, and `email`.

The client registry controls allowed scopes per GPT client.

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

Authorization requests may include an OIDC nonce. The service validates nonce syntax, stores the nonce with the authorization code, and places the nonce in the ID token issued during code exchange.

ID token `auth_time` reflects the authorization request time and remains stable across refresh token rotation.

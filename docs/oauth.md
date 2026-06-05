# OAuth

The service acts as a private OAuth and OIDC provider for configured GPT clients.

The first implementation supports authorization code flow, refresh tokens, signed access tokens, OIDC ID tokens, userinfo, JWKS, discovery metadata, exact redirect matching, scope enforcement, and resource-bound access tokens.

OAuth state is stored durably on disk. The store keeps hashes for authorization codes and refresh tokens. Raw secrets and raw bearer tokens are not stored.

The default local scopes are `openid`, `profile`, and `email`.

The client registry controls allowed scopes per GPT client.

Discovery metadata advertises the union of configured client scopes.

OIDC discovery metadata advertises the ID token and profile claims supported by the service.

Protected resource metadata advertises the scopes configured for clients that can use the MCP resource.

Authorization requests may include an OIDC nonce. The service validates nonce syntax, stores the nonce with the authorization code, and places the nonce in the ID token issued during code exchange.

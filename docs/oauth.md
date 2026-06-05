# OAuth

The service acts as a private OAuth and OIDC provider for configured GPT clients.

The first implementation supports authorization code flow, refresh tokens, signed access tokens, OIDC ID tokens, userinfo, JWKS, discovery metadata, exact redirect matching, scope enforcement, and resource-bound access tokens.

OAuth state is stored durably on disk. The store keeps hashes for authorization codes and refresh tokens. Raw secrets and raw bearer tokens are not stored.

The default local scopes are `openid`, `profile`, and `email`.

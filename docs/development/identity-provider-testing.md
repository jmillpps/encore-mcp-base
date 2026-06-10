# Identity Provider Testing

The runtime tests use a local upstream OIDC test provider. The provider is a Node HTTP server owned by the test harness. It exercises the same service contract used by external identity providers.

## Test Provider

`test/support/upstream-oidc.ts` starts the provider on a random `127.0.0.1` port for each test.

The provider exposes these endpoints:

| Endpoint | Behavior |
| --- | --- |
| `/.well-known/openid-configuration` | Returns issuer, endpoint, JWKS, scope, claim, and signing algorithm metadata. |
| `/jwks.json` | Returns the upstream public signing key used by ID token and signed userinfo tests. |
| `/oauth2/authorize` | Validates the authorization request, stores the PKCE challenge, and redirects to the service callback with an upstream code. |
| `/oauth2/token` | Validates the upstream code, client credentials, redirect URI, PKCE verifier, and nonce, then returns a bearer access token and signed ID token. |
| `/oauth2/userInfo` | Validates the bearer token and returns the configured user profile as JSON or signed userinfo. |

The provider uses these local credentials:

| Field | Value |
| --- | --- |
| Client ID | `upstream-client` |
| Client secret | `upstream-secret` |

The provider accepts `client_secret_post` and `client_secret_basic` token authentication.

## Generic Provider Contract

The test provider proves the service contract for any upstream OIDC provider that supplies compatible endpoints and claims.

| Contract item | Test harness behavior |
| --- | --- |
| Authorization endpoint | Receives the service-generated request and redirects to `/oauth/callback` with an upstream code. |
| Discovery endpoint | Supplies the issuer, configured endpoints, JWKS URI, and signing algorithms used by the service. |
| JWKS endpoint | Supplies the upstream public key selected by `kid`. |
| Token endpoint | Requires the upstream client credentials, redirect URI, code, and PKCE verifier, then returns an ID token with the service-generated nonce. |
| Userinfo endpoint | Requires the upstream bearer token and returns profile claims bound to the ID token subject. |
| Subject | Supplies the upstream `sub` that becomes the service subject. |
| Email | Supplies the upstream `email` used by Actions, MCP, and userinfo responses. |
| Email verification | Supplies `email_verified` as the source value for service profile normalization. |

Deployment-specific providers add tenant, domain, and client registration work outside the runtime tests. Runtime tests prove the generic protocol behavior.

## Service Harness

`test/support/service-process.ts` starts the local provider before it starts Encore. The service process receives `UPSTREAM_OIDC_*` values that point to the local provider.

The harness sets the service callback to:

```text
<service-origin>/oauth/callback
```

Each local test service receives a temporary OAuth file store path. Each test cleans up its service process, provider server, and temporary store.

## Flow Harness

`test/support/oauth-client.ts` drives the complete browser redirect sequence:

1. Request service authorization at `/oauth/authorize`.
2. Follow the redirect to the upstream provider authorization endpoint.
3. Follow the upstream redirect to `/oauth/callback`.
4. Follow the service redirect to the ChatGPT-style callback URL.
5. Exchange the service authorization code at `/oauth/token`.

The helper uses `oauth4webapi` for OAuth client-side processing. This keeps the service tests focused on provider behavior, token issuance, and protocol validation.

## Proof Tests

`test/oauth/upstream-oidc-bridge.test.ts` proves the upstream identity path.

The tests verify:

- The service issues tokens only after upstream authorization completes.
- The ID token uses the upstream user profile.
- `/oauth/userinfo` returns the upstream user profile.
- `GET /actions/profile` returns the upstream user profile.
- `client_secret_basic` works for upstream token exchange.
- Signed userinfo validates against upstream JWKS and subject binding.
- Discovery issuer mismatch is rejected.
- Missing ID token is rejected.
- ID token nonce mismatch is rejected.
- Userinfo subject mismatch is rejected.
- The default service test identity comes from the local upstream provider.

## Maintainer Rules

Update this test harness when upstream IdP behavior changes.

Add or update runtime tests when changing:

- Upstream authorization request parameters.
- `/oauth/callback` behavior.
- Upstream token request authentication.
- Upstream discovery metadata validation.
- Upstream JWKS key selection.
- Upstream ID token validation.
- Signed userinfo validation.
- PKCE validation.
- Userinfo parsing.
- Required profile claims.
- Profile claim derivation.
- Error handling for upstream token and userinfo failures.

CDK identity provider tests belong under `test/cdk/`. Runtime identity provider tests belong under `test/oauth/`, `test/actions/`, `test/mcp/`, or focused support modules under `test/support/`.

Vendor tenant verification happens during deployment release checks. Runtime tests prove the generic OIDC provider contract used by those tenants.

## Failure Coverage

Add or update tests for these upstream failure paths when the behavior changes:

| Failure path | Expected proof |
| --- | --- |
| Upstream state mismatch | Service rejects the callback and leaves the original authorization request unredeemed. |
| Upstream token rejection | Service returns a safe OAuth error and records safe diagnostics. |
| Discovery issuer mismatch | Service rejects the callback before token issuance. |
| Missing ID token | Service rejects the callback before token issuance. |
| ID token nonce mismatch | Service rejects the callback before token issuance. |
| Signed userinfo signature failure | Service rejects the callback before token issuance. |
| Userinfo subject mismatch | Service rejects the callback before token issuance. |
| Missing userinfo subject | Service rejects the profile before issuing service tokens. |
| Missing userinfo email | Service rejects the profile before Actions or MCP receive identity data. |
| Unsupported `email_verified` value | Profile normalization rejects the claim. |
| Redirect URI mismatch | Upstream token exchange fails through the local provider. |
| PKCE mismatch | Upstream token exchange fails through the local provider. |

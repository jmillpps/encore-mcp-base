# Identity Provider Testing

The runtime tests use a local upstream OIDC test provider. The provider is a Node HTTP server owned by the test harness. It exercises the same service contract used by external identity providers.

## Test Provider

`test/support/upstream-oidc.ts` starts the provider on a random `127.0.0.1` port for each test.

The provider exposes these endpoints:

| Endpoint | Behavior |
| --- | --- |
| `/oauth2/authorize` | Validates the authorization request, stores the PKCE challenge, and redirects to the service callback with an upstream code. |
| `/oauth2/token` | Validates the upstream code, client credentials, redirect URI, and PKCE verifier, then returns a bearer access token. |
| `/oauth2/userInfo` | Validates the bearer token and returns the configured user profile. |

The provider uses these local credentials:

| Field | Value |
| --- | --- |
| Client ID | `upstream-client` |
| Client secret | `upstream-secret` |

The provider accepts `client_secret_post` and `client_secret_basic` token authentication.

## Service Harness

`test/support/service-process.ts` starts the local provider before it starts Encore. The service process receives `UPSTREAM_OIDC_*` values that point to the local provider.

The harness sets the service callback to:

```text
<service-origin>/oauth/callback
```

Each test service receives a temporary OAuth store path. Each test cleans up its service process, provider server, and temporary store.

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
- The default service test identity comes from the local upstream provider.

## Maintainer Rules

Update this test harness when upstream IdP behavior changes.

Add or update runtime tests when changing:

- Upstream authorization request parameters.
- `/oauth/callback` behavior.
- Upstream token request authentication.
- PKCE validation.
- Userinfo parsing.
- Required profile claims.
- Profile claim derivation.
- Error handling for upstream token and userinfo failures.

CDK identity provider tests belong under `test/cdk/`. Runtime identity provider tests belong under `test/oauth/`, `test/actions/`, `test/mcp/`, or focused support modules under `test/support/`.

Vendor tenant verification happens during deployment release checks. Runtime tests prove the generic OIDC provider contract used by those tenants.

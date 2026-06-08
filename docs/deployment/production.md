# Production Deployment

Production deployment runs the Encore service with explicit public URLs, registered OAuth clients, upstream OIDC login, durable storage, allowed origins, signing keys, token lifetimes, and rate limits.

## Required Setup

1. Provision a public HTTPS origin.
2. Set `PUBLIC_ISSUER_URL` to that origin.
3. Set `MCP_RESOURCE_URL` to the public `/mcp` URL.
4. Set `ACTIONS_AUDIENCE` to the public Actions audience URL.
5. Set `OAUTH_STORE_PATH` to a durable JSON file path.
6. Register GPT clients in `OAUTH_CLIENTS_JSON`.
7. Configure `ALLOWED_ORIGINS` for ChatGPT origins.
8. Configure RSA signing key material.
9. Configure the upstream OIDC identity provider.
10. Register `/oauth/callback` as the upstream provider callback URL.
11. Use the public `/privacy` URL in GPT Action configuration.
12. Use the public `/actions/openapi.json` URL for GPT Actions schema import.
13. Set token lifetimes, rate limits, and SSE connection limits.

## Client Registry

Client record rules are covered in [Client Registry](client-registry.md).

Example Actions client:

```json
{
  "clientId": "actions-client",
  "clientSecretHash": "6-sAVn33y2sGHZl6331AmzWK0yMi6Qy5IXhdetApm38",
  "displayName": "GPT Actions",
  "redirectUris": ["https://chatgpt.com/aip/g-prod/oauth/callback"],
  "allowedScopes": ["openid", "profile", "email"],
  "allowedResources": ["https://service.example.com/actions"],
  "tokenEndpointAuthMethod": "client_secret_post",
  "pkcePolicy": "optional",
  "clientClass": "gpt-actions"
}
```

Generate client secrets with:

```sh
node --experimental-strip-types tools/generate-client-secret.ts
```

Store `clientSecret` in the GPT OAuth configuration. Store `clientSecretHash` in `OAUTH_CLIENTS_JSON`.

## Upstream Identity Provider

Configure these runtime variables:

| Variable | Purpose |
| --- | --- |
| `UPSTREAM_OIDC_ISSUER_URL` | Upstream issuer URL. |
| `UPSTREAM_OIDC_AUTHORIZATION_URL` | Upstream authorization endpoint. |
| `UPSTREAM_OIDC_TOKEN_URL` | Upstream token endpoint. |
| `UPSTREAM_OIDC_USERINFO_URL` | Upstream userinfo endpoint. |
| `UPSTREAM_OIDC_CLIENT_ID` | Upstream OAuth client ID. |
| `UPSTREAM_OIDC_CLIENT_SECRET` | Upstream OAuth client secret. |
| `UPSTREAM_OIDC_REDIRECT_URI` | Public service callback URL. |
| `UPSTREAM_OIDC_SCOPES` | Upstream scopes. |
| `UPSTREAM_OIDC_TOKEN_AUTH_METHOD` | Upstream token client authentication method. |

The default upstream scopes are `openid profile email`. Required userinfo claims are `sub`, `email`, and `email_verified`.

The public service callback URL is:

```text
https://service.example.com/oauth/callback
```

Identity provider behavior is covered in [Identity Provider](identity-provider.md).

## Deployment Checks

Run before release:

```sh
npm run check
node --experimental-strip-types tools/export-openapi.ts \
  --base-url https://service.example.com \
  --out var/actions.openapi.json
```

Verify public browser preflight behavior for `/mcp`, OAuth discovery metadata, JWKS, Actions OpenAPI import, GPT Apps MCP connection, and GPT Actions account linking.

## Runtime Placement

Deploy the service behind a public HTTPS origin that forwards headers and preserves streaming responses. Long-lived SSE responses require proxy timeouts that exceed the expected ChatGPT session lifetime.

Legacy `/sse` and `/messages` sessions are process-bound. Use sticky routing for legacy transport traffic or route GPT Apps to Streamable HTTP at `/mcp`.

## Secret Placement

Keep these values in the deployment secret manager:

- `OAUTH_PRIVATE_KEY_PEM`
- `UPSTREAM_OIDC_CLIENT_SECRET`
- OAuth client raw secrets configured in ChatGPT

Keep `OAUTH_CLIENTS_JSON` in environment configuration or a secret-backed config source. It contains secret hashes and operational client policy.

## AWS CDK Path

The AWS CDK deployment path is covered in [AWS CDK Deployment](aws-cdk.md). Command sequencing is covered in [CDK Operations](cdk-operations.md). Runtime Parameter Store values are covered in [Runtime Parameters](runtime-parameters.md). Source packaging and image builds are covered in [Source Build](source-build.md). Identity provider setup is covered in [Identity Provider](identity-provider.md). Post-deployment checks are covered in [Release Verification](release-verification.md).

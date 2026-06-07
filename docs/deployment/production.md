# Production Deployment

Production deployment runs the Encore service with explicit public URLs, registered OAuth clients, Cognito upstream login, durable storage, allowed origins, signing keys, token lifetimes, and rate limits.

## Required Setup

1. Provision a public HTTPS origin.
2. Set `PUBLIC_ISSUER_URL` to that origin.
3. Set `MCP_RESOURCE_URL` to the public `/mcp` URL.
4. Set `ACTIONS_AUDIENCE` to the public Actions audience URL.
5. Set `OAUTH_STORE_PATH` to a durable JSON file path.
6. Register GPT clients in `OAUTH_CLIENTS_JSON`.
7. Configure `ALLOWED_ORIGINS` for ChatGPT origins.
8. Configure RSA signing key material.
9. Configure Cognito upstream login.
10. Use the public `/privacy` URL in GPT Action configuration.
11. Set token lifetimes, rate limits, and SSE connection limits.

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
- `COGNITO_CLIENT_SECRET`
- OAuth client raw secrets configured in ChatGPT

Keep `OAUTH_CLIENTS_JSON` in environment configuration or a secret-backed config source. It contains secret hashes and operational client policy.

## AWS CDK Path

The AWS CDK deployment path is covered in [AWS CDK Deployment](aws-cdk.md).

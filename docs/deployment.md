# Deployment

Production deployment requires an explicit public issuer URL, MCP resource URL, Actions audience URL, OAuth store path, client registry, allowed origins, and signing key material.

Production deployments set these required environment variables:

- `PUBLIC_ISSUER_URL`
- `MCP_RESOURCE_URL`
- `ACTIONS_AUDIENCE`
- `OAUTH_STORE_PATH`
- `ALLOWED_ORIGINS`
- `OAUTH_CLIENTS_JSON`
- `OAUTH_PRIVATE_KEY_PEM`
- `OAUTH_KEY_ID`
- `ACCESS_TOKEN_TTL_SECONDS`
- `ID_TOKEN_TTL_SECONDS`
- `AUTHORIZATION_CODE_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_SECONDS`
- `RATE_LIMIT_WINDOW_SECONDS`
- `RATE_LIMIT_MAX_REQUESTS`

Production deployments set `OAUTH_PREVIOUS_PUBLIC_KEYS_JSON` during signing key rotation.

The local development profile may generate signing keys and use local test clients.

Production startup must fail when required security configuration is missing.

## Client Registry

Use `node tools/generate-client-secret.mjs` to create a GPT client secret and registry hash.

Place `clientSecret` in the GPT OAuth configuration.

Place `clientSecretHash` in the matching `OAUTH_CLIENTS_JSON` client record.

Keep raw client secrets out of deployment logs, repository files, shell history, and `OAUTH_CLIENTS_JSON`.

Each `OAUTH_CLIENTS_JSON` record contains these fields:

```json
{
  "clientId": "gpt-actions-prod",
  "clientSecretHash": "6-sAVn33y2sGHZl6331AmzWK0yMi6Qy5IXhdetApm38",
  "displayName": "GPT Actions Production",
  "redirectUris": ["https://chatgpt.com/aip/g-prod/oauth/callback"],
  "allowedScopes": ["openid", "profile", "email"],
  "allowedResources": ["https://service.example.com/actions"],
  "tokenEndpointAuthMethod": "client_secret_post",
  "pkcePolicy": "optional",
  "clientClass": "gpt-actions"
}
```

Register exact GPT callback URLs for each GPT client.

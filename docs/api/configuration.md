# Configuration Reference

Production mode is active when `NODE_ENV=production`.

## Required Production Variables

| Variable | Type | Rule |
| --- | --- | --- |
| `PUBLIC_ISSUER_URL` | URL | Public issuer origin. HTTPS. Root path. Public hostname. |
| `MCP_RESOURCE_URL` | URL | Public MCP resource URL. HTTPS. Public hostname. Path ends with `/mcp`. |
| `ACTIONS_AUDIENCE` | URL | Public Actions audience URL. HTTPS. Public hostname. |
| `WIDGET_DOMAIN` | URL | ChatGPT Apps widget origin. HTTPS. Root path. Public hostname. Unique per app. |
| `OAUTH_STORE_BACKEND` | enum | Production value is `dynamodb`. |
| `OAUTH_DYNAMODB_TABLE_NAME` | string | DynamoDB table that stores OAuth, MCP session, and rate-limit state. |
| `OAUTH_DYNAMODB_REGION` | string | AWS Region for the DynamoDB table. |
| `ALLOWED_ORIGINS` | string list | Space-separated browser origins allowed for ChatGPT. |
| `OAUTH_CLIENTS_JSON` | JSON array | Configured OAuth clients. |
| `OAUTH_PRIVATE_KEY_PEM` or `OAUTH_PRIVATE_KEY_PEM_FILE` | PEM or file path | Active RSA private key source for token signing. |
| `OAUTH_KEY_ID` | string | Active signing key ID. |
| `UPSTREAM_OIDC_ISSUER_URL` | URL | Upstream identity provider issuer URL. |
| `UPSTREAM_OIDC_DISCOVERY_URL` | URL | Upstream discovery document URL. Default is the issuer plus `/.well-known/openid-configuration`. |
| `UPSTREAM_OIDC_AUTHORIZATION_URL` | URL | Upstream authorization endpoint. |
| `UPSTREAM_OIDC_TOKEN_URL` | URL | Upstream token endpoint. |
| `UPSTREAM_OIDC_USERINFO_URL` | URL | Upstream userinfo endpoint. |
| `UPSTREAM_OIDC_CLIENT_ID` | string | Upstream OAuth client ID. |
| `UPSTREAM_OIDC_CLIENT_SECRET` | string | Upstream OAuth client secret. |
| `UPSTREAM_OIDC_REDIRECT_URI` | URL | Service callback URL, normally `https://service.example.com/oauth/callback`. |
| `UPSTREAM_OIDC_SCOPES` | string list | Upstream scopes. Must include `openid`. |
| `UPSTREAM_OIDC_TOKEN_AUTH_METHOD` | enum | Upstream token client authentication method. Supported values are `client_secret_post` and `client_secret_basic`. |
| `ACCESS_TOKEN_TTL_SECONDS` | integer | Access token lifetime. |
| `ID_TOKEN_TTL_SECONDS` | integer | ID token lifetime. |
| `AUTHORIZATION_CODE_TTL_SECONDS` | integer | Authorization code lifetime. |
| `REFRESH_TOKEN_TTL_SECONDS` | integer | Refresh token lifetime. |
| `RATE_LIMIT_WINDOW_SECONDS` | integer | Durable rate-limit window length. |
| `RATE_LIMIT_MAX_REQUESTS` | integer | Request limit per bucket and subject. |
| `RATE_LIMIT_POLICIES_JSON` | JSON object | Per-bucket sliding rate-limit overrides. Use `{}` for defaults. |
| `MCP_LIST_PAGE_SIZE` | integer | Maximum MCP list items returned per page. Maximum value is `256`. |
| `MCP_SSE_MAX_CONNECTIONS` | integer | Maximum open SSE receive streams. |

## Optional Production Variables

| Variable | Purpose |
| --- | --- |
| `OAUTH_PREVIOUS_PUBLIC_KEYS_JSON` | Previous public signing keys kept available for token verification and JWKS publication. |

Production signing requires `OAUTH_KEY_ID` and one private key source: `OAUTH_PRIVATE_KEY_PEM` or `OAUTH_PRIVATE_KEY_PEM_FILE`.

## Local Defaults

Local development supplies defaults for URLs, origins, token lifetimes, rate limits, local clients, and upstream OIDC connection settings.

| Variable | Local value |
| --- | --- |
| `PUBLIC_ISSUER_URL` | `http://localhost:4000` |
| `MCP_RESOURCE_URL` | `http://localhost:4000/mcp` |
| `ACTIONS_AUDIENCE` | `http://localhost:4000/actions` |
| `WIDGET_DOMAIN` | `http://localhost:4000` |
| `OAUTH_STORE_BACKEND` | `file` |
| `OAUTH_STORE_PATH` | `var/oauth-store.json` |
| `ALLOWED_ORIGINS` | `https://chatgpt.com https://chat.openai.com http://localhost:4000` |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` |
| `ID_TOKEN_TTL_SECONDS` | `300` |
| `AUTHORIZATION_CODE_TTL_SECONDS` | `300` |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` |
| `RATE_LIMIT_MAX_REQUESTS` | `120` |
| `RATE_LIMIT_POLICIES_JSON` | unset |
| `MCP_LIST_PAGE_SIZE` | `128` |
| `MCP_SSE_MAX_CONNECTIONS` | `1024` |
| `UPSTREAM_OIDC_ISSUER_URL` | `http://127.0.0.1:4100` |
| `UPSTREAM_OIDC_DISCOVERY_URL` | `http://127.0.0.1:4100/.well-known/openid-configuration` |
| `UPSTREAM_OIDC_AUTHORIZATION_URL` | `http://127.0.0.1:4100/oauth2/authorize` |
| `UPSTREAM_OIDC_TOKEN_URL` | `http://127.0.0.1:4100/oauth2/token` |
| `UPSTREAM_OIDC_USERINFO_URL` | `http://127.0.0.1:4100/oauth2/userInfo` |
| `UPSTREAM_OIDC_CLIENT_ID` | `local-upstream-client` |
| `UPSTREAM_OIDC_CLIENT_SECRET` | `local-upstream-secret` |
| `UPSTREAM_OIDC_REDIRECT_URI` | `http://localhost:4000/oauth/callback` |
| `UPSTREAM_OIDC_SCOPES` | `openid profile email` |
| `UPSTREAM_OIDC_TOKEN_AUTH_METHOD` | `client_secret_post` |

Automated service tests replace these upstream values with a per-test OIDC server. Manual local OAuth account linking needs an upstream provider at the configured local URLs or explicit `UPSTREAM_OIDC_*` overrides.

## URL Rules

Production URLs use HTTPS and public hostnames. URLs must omit credentials, query strings, and fragments.

`PUBLIC_ISSUER_URL` and `WIDGET_DOMAIN` use origin roots. `MCP_RESOURCE_URL` points to `/mcp`. `ALLOWED_ORIGINS` entries are origins.

`PUBLIC_ISSUER_URL` also feeds `GET /actions/openapi.json`, OAuth discovery metadata, token issuer claims, and OpenAPI OAuth URLs.

`WIDGET_DOMAIN` feeds MCP Apps UI resource metadata through `_meta.ui.domain` and `_meta["openai/widgetDomain"]`.

## Rate-Limit Policies

`RATE_LIMIT_WINDOW_SECONDS` and `RATE_LIMIT_MAX_REQUESTS` define the default sliding counter policy for every durable bucket.

`RATE_LIMIT_POLICIES_JSON` can override `windowSeconds` and `maxRequests` for these buckets:

- `oauth-authorize`
- `oauth-token`
- `oauth-userinfo`
- `mcp-tool`
- `mcp-resource`

Example:

```json
{
  "oauth-token": { "windowSeconds": 30, "maxRequests": 40 },
  "mcp-tool": { "maxRequests": 240 }
}
```

## Integer Rules

Integer environment variables use positive safe integers. Production startup fails when a required integer is missing, empty, non-integer, zero, or negative.

## Upstream Identity Rules

Production identity comes from upstream OIDC ID token validation and userinfo. Userinfo must return `sub`, `email`, and `email_verified`. Optional display claims include `given_name`, `family_name`, `name`, and `preferred_username`.

Profile string values must be present when required, must be at most 256 characters, and must omit line breaks. `email` must be an email address. `email_verified` must be a boolean value or a string boolean accepted by normalization.

## Upstream OIDC Rules

Upstream endpoint URLs use HTTPS and public hostnames in production. `UPSTREAM_OIDC_SCOPES` must include `openid`. The service uses PKCE and a service-generated nonce for upstream authorization and exchanges upstream authorization codes through the configured token endpoint.

The upstream discovery document must return the configured issuer, authorization endpoint, token endpoint, userinfo endpoint, JWKS URI, and ID token signing algorithms. The service validates upstream ID token signature, issuer, audience, expiration, issued-at time, nonce, and access-token hash when present. Signed userinfo responses must validate against the upstream JWKS, issuer, audience, and ID token subject.

The upstream identity provider must register `UPSTREAM_OIDC_REDIRECT_URI` as an allowed callback URL. The service callback route is `/oauth/callback`.

## Startup Validation

Startup validation reads configuration, validates the configured storage backend, loads clients, validates upstream OIDC settings, and loads signing keys. Production startup fails when required security material is missing or unsafe.

Signing keys must be RSA keys with at least 2048 bits. Key IDs use 1 to 128 safe characters. Previous public keys must have unique key IDs.

## CDK Runtime Parameters

The CDK deployment writes runtime variables to AWS Systems Manager Parameter Store. The EC2 runner reads the configured parameter path, writes the container environment file, writes the private signing key file, and runs the service with DynamoDB state table parameters.

Use [Runtime Parameters](../deployment/runtime-parameters.md) for the Parameter Store values and [AWS CDK Deployment](../deployment/aws-cdk.md) for deployment inputs.

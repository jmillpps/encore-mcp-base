# Configuration Reference

Production mode is active when `NODE_ENV=production`.

## Required Production Variables

| Variable | Type | Rule |
| --- | --- | --- |
| `PUBLIC_ISSUER_URL` | URL | Public issuer origin. HTTPS. Root path. Public hostname. |
| `MCP_RESOURCE_URL` | URL | Public MCP resource URL. HTTPS. Public hostname. Path ends with `/mcp`. |
| `ACTIONS_AUDIENCE` | URL | Public Actions audience URL. HTTPS. Public hostname. |
| `OAUTH_STORE_PATH` | file path | Durable OAuth store JSON path. |
| `ALLOWED_ORIGINS` | string list | Space-separated browser origins allowed for ChatGPT. |
| `OAUTH_CLIENTS_JSON` | JSON array | Configured OAuth clients. |
| `OAUTH_PRIVATE_KEY_PEM` | PEM | Active RSA private key for token signing. |
| `OAUTH_PRIVATE_KEY_PEM_FILE` | file path | Active RSA private key file used when the key is loaded from Parameter Store onto the instance filesystem. |
| `OAUTH_KEY_ID` | string | Active signing key ID. |
| `UPSTREAM_OIDC_ISSUER_URL` | URL | Upstream identity provider issuer URL. |
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
| `MCP_SSE_MAX_CONNECTIONS` | integer | Maximum open SSE receive streams. |

## Optional Production Variables

| Variable | Purpose |
| --- | --- |
| `OAUTH_PREVIOUS_PUBLIC_KEYS_JSON` | Previous public signing keys kept available for token verification and JWKS publication. |

## Local Defaults

Local development supplies defaults for URLs, origins, token lifetimes, rate limits, local clients, and upstream OIDC connection settings.

| Variable | Local value |
| --- | --- |
| `PUBLIC_ISSUER_URL` | `http://localhost:4000` |
| `MCP_RESOURCE_URL` | `http://localhost:4000/mcp` |
| `ACTIONS_AUDIENCE` | `http://localhost:4000/actions` |
| `OAUTH_STORE_PATH` | `var/oauth-store.json` |
| `ALLOWED_ORIGINS` | `https://chatgpt.com https://chat.openai.com http://localhost:4000` |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` |
| `ID_TOKEN_TTL_SECONDS` | `300` |
| `AUTHORIZATION_CODE_TTL_SECONDS` | `300` |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` |
| `RATE_LIMIT_MAX_REQUESTS` | `120` |
| `MCP_SSE_MAX_CONNECTIONS` | `1024` |
| `UPSTREAM_OIDC_ISSUER_URL` | `http://127.0.0.1:4100` |
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

`PUBLIC_ISSUER_URL` uses the origin root. `MCP_RESOURCE_URL` points to `/mcp`. `ALLOWED_ORIGINS` entries are origins.

`PUBLIC_ISSUER_URL` also feeds `GET /actions/openapi.json`, OAuth discovery metadata, token issuer claims, and OpenAPI OAuth URLs.

## Integer Rules

Integer environment variables use positive safe integers. Production startup fails when a required integer is missing, empty, non-integer, zero, or negative.

## Upstream Identity Rules

Production identity comes from upstream OIDC userinfo. Userinfo must return `sub`, `email`, and `email_verified`. Optional display claims include `given_name`, `family_name`, `name`, and `preferred_username`.

Profile string values must be present when required, must be at most 256 characters, and must omit line breaks. `email` must be an email address. `email_verified` must be a boolean value.

## Upstream OIDC Rules

Upstream endpoint URLs use HTTPS and public hostnames in production. `UPSTREAM_OIDC_SCOPES` must include `openid`. The service uses PKCE for upstream authorization and exchanges upstream authorization codes through the configured token endpoint.

The upstream identity provider must register `UPSTREAM_OIDC_REDIRECT_URI` as an allowed callback URL. The service callback route is `/oauth/callback`.

## Startup Validation

Startup validation reads configuration, resolves the store path, loads clients, validates upstream OIDC settings, and loads signing keys. Production startup fails when required security material is missing or unsafe.

## CDK Runtime Parameters

The CDK deployment writes runtime variables to AWS Systems Manager Parameter Store. The EC2 runner reads the configured parameter path, writes the container environment file, writes the private signing key file, and mounts durable state under `/var/lib/<service-name>`.

Use [Runtime Parameters](../deployment/runtime-parameters.md) for the Parameter Store values and [AWS CDK Deployment](../deployment/aws-cdk.md) for deployment inputs.

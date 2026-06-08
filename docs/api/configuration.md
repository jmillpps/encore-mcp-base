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
| `COGNITO_ENABLED` | boolean | Enables Cognito upstream login. |
| `COGNITO_ISSUER_URL` | URL | Cognito issuer URL. Required when Cognito is enabled. |
| `COGNITO_AUTHORIZATION_URL` | URL | Cognito authorization endpoint. Required when Cognito is enabled. |
| `COGNITO_TOKEN_URL` | URL | Cognito token endpoint. Required when Cognito is enabled. |
| `COGNITO_USERINFO_URL` | URL | Cognito userinfo endpoint. Required when Cognito is enabled. |
| `COGNITO_CLIENT_ID` | string | Cognito OAuth app client ID. Required when Cognito is enabled. |
| `COGNITO_CLIENT_SECRET` | string | Cognito OAuth app client secret. Required when Cognito is enabled. |
| `COGNITO_REDIRECT_URI` | URL | Service callback URL for Cognito. Required when Cognito is enabled. |
| `COGNITO_SCOPES` | string list | Cognito scopes. Must include `openid`. Required when Cognito is enabled. |
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
| `STATIC_USER_SUB` | Stable subject identifier for static profile mode. |
| `STATIC_USER_GIVEN_NAME` | Given name for static profile mode. |
| `STATIC_USER_FAMILY_NAME` | Family name for static profile mode. |
| `STATIC_USER_NAME` | Display name for static profile mode. |
| `STATIC_USER_PREFERRED_USERNAME` | Preferred username for static profile mode. |
| `STATIC_USER_EMAIL` | Email address for static profile mode. |
| `STATIC_USER_EMAIL_VERIFIED` | Email verification claim for static profile mode. |

## Local Defaults

Local development supplies defaults for URLs, origins, token lifetimes, rate limits, and local clients.

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
| `STATIC_USER_SUB` | `user_example` |
| `STATIC_USER_GIVEN_NAME` | `Example` |
| `STATIC_USER_FAMILY_NAME` | `User` |
| `STATIC_USER_NAME` | `Example User` |
| `STATIC_USER_PREFERRED_USERNAME` | `example.user` |
| `STATIC_USER_EMAIL` | `user@example.test` |
| `STATIC_USER_EMAIL_VERIFIED` | `true` |

## URL Rules

Production URLs use HTTPS and public hostnames. URLs must omit credentials, query strings, and fragments.

`PUBLIC_ISSUER_URL` uses the origin root. `MCP_RESOURCE_URL` points to `/mcp`. `ALLOWED_ORIGINS` entries are origins.

`PUBLIC_ISSUER_URL` also feeds `GET /actions/openapi.json`, OAuth discovery metadata, token issuer claims, and OpenAPI OAuth URLs.

## Integer Rules

Integer environment variables use positive safe integers. Production startup fails when a required integer is missing, empty, non-integer, zero, or negative.

## Static Identity Rules

Cognito mode reads profile claims from Cognito userinfo. Static profile mode reads `STATIC_USER_*` values. Profile string values must be present, must be at most 256 characters, and must omit line breaks. `STATIC_USER_EMAIL` must be an email address. `STATIC_USER_EMAIL_VERIFIED` must be `true` or `false`.

## Cognito Rules

Cognito endpoint URLs use HTTPS and public hostnames in production. `COGNITO_SCOPES` must include `openid`. The service uses PKCE for Cognito authorization and exchanges Cognito codes through the configured token endpoint.

## Startup Validation

Startup validation reads configuration, resolves the store path, loads clients, validates identity mode, and loads signing keys. Production startup fails when required security material is missing or unsafe.

## CDK Runtime Parameters

The CDK deployment writes runtime variables to AWS Systems Manager Parameter Store. The EC2 runner reads the configured parameter path, writes the container environment file, writes the private signing key file, and mounts durable state under `/var/lib/<service-name>`.

Use [Runtime Parameters](../deployment/runtime-parameters.md) for the Parameter Store values and [AWS CDK Deployment](../deployment/aws-cdk.md) for deployment inputs.

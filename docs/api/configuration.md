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
| `OAUTH_KEY_ID` | string | Active signing key ID. |
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

## URL Rules

Production URLs use HTTPS and public hostnames. URLs must omit credentials, query strings, and fragments.

`PUBLIC_ISSUER_URL` uses the origin root. `MCP_RESOURCE_URL` points to `/mcp`. `ALLOWED_ORIGINS` entries are origins.

## Integer Rules

Integer environment variables use positive safe integers. Production startup fails when a required integer is missing, empty, non-integer, zero, or negative.

## Startup Validation

Startup validation reads configuration, resolves the store path, loads clients, and loads signing keys. Production startup fails when required security material is missing or unsafe.

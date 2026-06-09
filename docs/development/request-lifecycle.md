# Request Lifecycle

This guide traces the main runtime paths a developer needs to understand before changing behavior.

## Shared Entry Points

Encore exposes separate service roots:

| Root | Runtime role |
| --- | --- |
| `auth/encore.service.ts` | OAuth, OIDC, discovery, JWKS, userinfo, and upstream callback endpoints. |
| `mcp/encore.service.ts` | MCP Streamable HTTP and legacy HTTP/SSE endpoints. |
| `actions/encore.service.ts` | GPT Actions REST endpoints, health, privacy, and OpenAPI. |

Each public request reaches a focused endpoint file. Endpoint files parse transport input, call shared validators, then call the domain module for the behavior.

## OAuth Account Linking

The OAuth flow uses these steps:

1. ChatGPT opens `/oauth/authorize`.
2. The endpoint rejects query access tokens and duplicate or unsupported parameters.
3. `auth/authorize.ts` resolves the client, redirect URI, scopes, resource, PKCE fields, nonce, and ID token hint.
4. `auth/upstream-authorization.ts` stores an upstream state record with hashed state material.
5. The browser redirects to the configured upstream OIDC authorization endpoint.
6. The upstream provider sends the browser back to `/oauth/callback`.
7. `auth/endpoints.upstream-callback.ts` consumes the upstream state once.
8. `auth/upstream-oidc-client.ts` exchanges the upstream code and reads userinfo.
9. The service creates its own authorization code for the original ChatGPT redirect URI.
10. ChatGPT exchanges that code at `/oauth/token`.
11. `auth/token.ts` issues access, ID, and refresh tokens with the service issuer.

Refresh grants rotate refresh tokens. Reuse of an older refresh token revokes the token family.

## MCP Requests

MCP traffic uses these steps:

1. ChatGPT sends requests to `/mcp`, `/sse`, or `/messages`.
2. Transport code rejects query access tokens and validates the `Authorization` header.
3. `auth/bearer.ts` validates the RS256 access token against `MCP_RESOURCE_URL`.
4. Streamable HTTP initializes a session and returns `MCP-Session-Id`.
5. `mcp/request-body.ts` and JSON-RPC helpers validate the message shape.
6. `mcp/lifecycle.ts` enforces initialization state and method rules.
7. `mcp/tool-registry.ts` dispatches `tools/list` and `tools/call`.
8. `mcp/resource-registry.ts` dispatches `resources/list`, `resources/read`, and `resources/templates/list`.
9. Tool adapters validate arguments, enforce scopes, run the capability, and validate structured output.
10. Resource adapters validate URIs, enforce scopes, and return content with safe metadata.
11. Transport code writes JSON-RPC responses, `202` acknowledgments, auth challenges, or SSE events.

Legacy `/sse` sessions are process-bound. Streamable HTTP sessions live in durable OAuth state.

## Actions Requests

Actions traffic uses these steps:

1. ChatGPT imports `/actions/openapi.json` or a generated OpenAPI file.
2. ChatGPT account linking uses the same OAuth provider as Apps.
3. ChatGPT calls `/actions/profile` or `/actions/session` with an Actions-audience bearer token.
4. Endpoint files reject `access_token` query parameters.
5. `actions/action-bearer.ts` validates the bearer token against `ACTIONS_AUDIENCE`.
6. The endpoint enforces required scopes.
7. The handler returns a typed JSON response.
8. Encore shapes authentication and authorization errors with `code`, `message`, `details`, and `internal_message`.

`/health`, `/privacy`, and `/actions/openapi.json` are public read-only endpoints.

## Shared Capability Path

Shared behavior lives outside protocol adapters when both GPT Apps and GPT Actions need the same result.

| Capability | Shared source | MCP adapter | Actions adapter |
| --- | --- | --- | --- |
| Service health | `shared/service-info.ts`, `shared/time.ts` | `mcp/tools/health-check.ts` | `actions/endpoints.health.ts` |
| Service health UI | `shared/service-info.ts`, `shared/time.ts` | `mcp/tools/health-status-card.ts`, `mcp/resources/health-status-card.ts` | none |
| Identity profile | `auth/user-profile.ts` | `mcp/tools/identity-profile.ts` | `actions/endpoints.profile.ts` |
| Identity profile UI | `auth/user-profile.ts` | `mcp/tools/identity-profile-card.ts`, `mcp/resources/profile-summary-card.ts` | none |
| OAuth session | token claims from `auth/bearer.ts` | `mcp/tools/auth-session.ts` | `actions/endpoints.session.ts` |

Keep new shared behavior in a focused module. Keep request parsing, protocol envelopes, and protocol metadata inside the adapter.

## Diagnostics And Storage

OAuth, MCP, and Actions failures emit safe diagnostics through `shared/diagnostics.ts`. Redaction uses key names to protect tokens, secrets, authorization codes, session IDs, state, nonce, and private key material.

Durable OAuth state lives in the configured store path. The store holds hashed authorization codes, hashed upstream states, refresh token families, MCP sessions, and rate-limit buckets.

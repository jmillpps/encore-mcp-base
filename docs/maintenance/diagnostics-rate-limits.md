# Diagnostics And Rate Limits

Diagnostics and rate limits help operators understand service behavior without exposing secrets.

## Diagnostics

Service diagnostics use structured events. Authentication and OAuth errors return safe client responses. Diagnostic fields redact credential values and avoid internal messages for unhandled errors.

Operational review should inspect diagnostic status, endpoint, method, subject, and error code. Secret-bearing fields stay absent from diagnostic output.

Actions error responses include `code`, `message`, `details`, and `internal_message`. Authentication and authorization failures return safe messages. Internal details stay absent from caller-visible responses.

Redaction applies to exact secret field names such as authorization codes, OAuth codes, code challenges, code verifiers, nonces, session IDs, and state values. Redaction also applies to field names containing API key, authorization, cookie, password, private key, secret, signing key, or token.

## Rate Limits

Durable rate-limit buckets apply to:

- OAuth authorization.
- OAuth token grants.
- OAuth userinfo.
- MCP tool calls.
- MCP resource reads.

Buckets are keyed by logical subject and stored as hashed durable keys. Rate limits use sliding counter windows with current and previous window counts.

| Bucket | Subject source |
| --- | --- |
| `oauth-authorize` | OAuth client ID when available, otherwise remote address. |
| `oauth-token` | Form client ID, Basic auth client ID, or remote address fallback. |
| `oauth-userinfo` | Remote address. |
| `mcp-tool` | Request subject for the MCP tool call. |
| `mcp-resource` | Request subject for the MCP resource read. |

SSE connection limits use an in-process counter controlled by `MCP_SSE_MAX_CONNECTIONS`. Durable rate limits use the OAuth store.

The default policy comes from `RATE_LIMIT_WINDOW_SECONDS` and `RATE_LIMIT_MAX_REQUESTS`. Per-bucket overrides come from `RATE_LIMIT_POLICIES_JSON`.

When a request is limited, the service emits `rate_limit_exceeded` with `bucket`, `subjectHash`, `windowSeconds`, and `maxRequests`.

## Operator Response

Repeated `rate_limited` responses indicate either client retry pressure, account-linking loops, or scripted traffic. Review the endpoint and subject before increasing limits.

Use this order for authentication and authorization failures:

1. Confirm the endpoint and HTTP method.
2. Confirm the token audience matches the requested surface.
3. Confirm required scopes are present.
4. Confirm the bearer token is current.
5. Confirm the OAuth client record allows the requested resource.
6. Review rate-limit buckets for the same subject.

## Failure Interpretation

| Symptom | Likely area | Review |
| --- | --- | --- |
| `invalid_token` challenge on MCP | Bearer token validation. | Audience, issuer, expiration, signing key, and protected resource metadata. |
| `insufficient_scope` challenge on MCP tool | Tool-level authorization. | Granted scopes, tool descriptor scopes, and account-linking scope request. |
| `unauthenticated` from Actions | Actions bearer validation. | Token audience, issuer, expiration, signing key, and Authorization header. |
| `permission_denied` from Actions | Actions scope validation. | Granted scopes and endpoint scope list. |
| `invalid_grant` from OAuth token | Code, verifier, refresh token, redirect URI, resource, or client mismatch. | Token request fields and durable grant state. |
| `rate_limited` from OAuth, MCP tools, or MCP resources | Durable bucket limit. | Bucket, subject hash, retry behavior, and configured limits. |

## Safe Review Fields

Operational review can use:

| Field | Purpose |
| --- | --- |
| status | Distinguish client errors from service errors. |
| endpoint | Identify the public surface. |
| method | Identify the HTTP method. |
| subject | Group retries by logical caller. |
| error code | Identify validation, authentication, authorization, and rate-limit outcomes. |

Bearer tokens, authorization codes, refresh tokens, client secrets, and private keys stay absent from diagnostic output.

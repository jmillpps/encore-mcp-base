# Diagnostics And Rate Limits

Diagnostics and rate limits help operators understand service behavior without exposing secrets.

## Diagnostics

Service diagnostics use structured events. Authentication and OAuth errors return safe client responses. Diagnostic fields redact credential values and avoid internal messages for unhandled errors.

Operational review should inspect diagnostic status, endpoint, method, subject, and error code. Secret-bearing fields stay absent from diagnostic output.

## Rate Limits

Durable rate-limit buckets apply to:

- OAuth authorization.
- OAuth token grants.
- OAuth userinfo.
- MCP tool calls.

Buckets are keyed by logical subject and stored as hashed durable keys. Expired buckets are pruned before current hits are recorded.

## Operator Response

Repeated `rate_limited` responses indicate either client retry pressure, account-linking loops, or scripted traffic. Review the endpoint and subject before increasing limits.

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

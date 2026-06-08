# Security Review

Use this checklist before merging runtime behavior, protocol changes, deployment changes, or test harness changes.

## Trust Boundaries

Review every value crossing these boundaries:

| Boundary | Untrusted input |
| --- | --- |
| ChatGPT OAuth requests | Client ID, redirect URI, state, scopes, resource, nonce, PKCE, ID token hints. |
| Upstream identity provider | Authorization code, state, token response, userinfo claims. |
| MCP transport | Headers, session IDs, protocol version, JSON-RPC messages, tool arguments. |
| Actions endpoints | Headers, query parameters, bearer tokens, request paths. |
| Client metadata | Metadata URL, metadata JSON, JWKS URL, JWKS keys, client assertions. |
| Runtime configuration | Environment variables, Parameter Store values, file paths, URL strings. |
| Durable storage | Store file path, lock file path, stored records, permissions. |

## Required Controls

Confirm the changed code preserves:

- Exact redirect URI matching.
- Surface-specific audience validation.
- Scope enforcement for every protected tool and endpoint.
- Bearer token use through the `Authorization` header.
- PKCE policy enforcement.
- Refresh token rotation.
- Replay protection for refresh tokens and private key JWT assertions.
- Public HTTPS URL rules in production.
- Store path permission checks.
- Secret redaction in diagnostics.
- Safe caller-facing errors.
- Durable rate limits on OAuth endpoints and MCP tools.

## Review Sequence

Use this order during review:

1. Identify every public route, tool, background command, configuration source, and stored row touched by the change.
2. Identify the attacker-controlled fields for each touched path.
3. Identify the validator that rejects malformed values.
4. Identify the bearer audience and required scopes.
5. Identify every secret that can enter the path.
6. Identify the diagnostics emitted by success, rejection, and service failure paths.
7. Identify the targeted tests that prove the boundary.

Record unresolved security questions in the change notes before merge.

## Secret Handling

Raw secrets include client secrets, bearer tokens, authorization codes, refresh tokens, upstream tokens, signing private keys, session IDs, state, nonce, and cookies.

Keep raw secrets out of:

- Repository files.
- Documentation examples.
- Test names.
- Logs.
- Diagnostic fields.
- Shell history.
- Commit messages.

Use generated examples and generic domains in documentation.

## Error Review

Client-facing errors should reveal the category of failure and preserve the trust boundary.

Review:

- OAuth error code and safe description.
- Actions `code`, `message`, `details`, and `internal_message`.
- MCP `WWW-Authenticate` challenge fields.
- Tool error result text.
- Diagnostic event fields.

## Abuse Case Matrix

| Area | Abuse case | Required proof |
| --- | --- | --- |
| OAuth authorize | Redirect URI substitution, resource substitution, oversized state, invalid PKCE, replayed upstream state. | Authorization and upstream bridge tests. |
| OAuth token | Reused code, reused refresh token, invalid client auth, invalid resource, invalid client assertion. | Token, refresh, client-auth, and private key JWT tests. |
| MCP transport | Query bearer token, duplicate auth header, wrong audience, request-ID replay, invalid protocol version. | MCP transport and request-ID tests. |
| MCP tools | Missing scope, invalid arguments, invalid output shape, unsafe tool error text. | Protected tool, descriptor, and output validation tests. |
| Actions | Query bearer token, wrong audience, missing scope, schema drift, unsafe error fields. | Actions auth, endpoint, and OpenAPI tests. |
| Client metadata | Untrusted metadata URL, invalid metadata JSON, invalid JWKS, assertion replay. | Client metadata and private key JWT tests. |
| Storage | Unsafe path, symlink, permissive file mode, partial write, lock contention. | Store security, store file, and rate-limit store tests. |
| Diagnostics | Secret leakage through fields, messages, or nested values. | Diagnostics redaction tests. |

## Test Review

Security tests should exercise live behavior where the boundary is HTTP, OAuth, MCP, or Actions.

Add or update tests for:

- Missing bearer token.
- Malformed bearer token.
- Wrong audience.
- Missing scope.
- Query access token.
- Duplicate authorization header.
- Invalid redirect URI.
- Invalid resource.
- Invalid metadata client.
- Rate-limit enforcement.
- Store file permission rejection.

## Merge Review Questions

Answer these questions before merging:

- Which public surface accepts the changed input?
- Which validator rejects malformed input?
- Which token audience applies?
- Which scopes apply?
- Which secrets could appear during this path?
- Which diagnostics prove the behavior without exposing secrets?
- Which targeted tests prove the security boundary?

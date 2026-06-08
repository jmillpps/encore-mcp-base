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

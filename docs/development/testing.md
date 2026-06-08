# Testing

The test suite proves live service behavior, protocol contracts, security boundaries, and repository structure.

## Common Commands

Run targeted tests while developing:

```sh
node --experimental-strip-types --test --test-concurrency=1 test/mcp/transport-bearer.test.ts
```

Run the typecheck for changes that affect TypeScript types:

```sh
npm run typecheck
```

Run the full gate before release:

```sh
npm run check
```

## Gate Coverage

`npm run check` runs:

- TypeScript typecheck.
- Dependency boundary check.
- Architecture check.
- File-scope check.
- Test-placement check.
- Full test suite.

## Test Areas

| Area | Coverage |
| --- | --- |
| Actions | OAuth scopes, wrong audience tokens, expired tokens, OpenAPI compatibility. |
| MCP | Transports, auth challenges, protocol versioning, JSON-RPC shape, SSE lifetime, tool descriptors, tool output validation. |
| OAuth | Authorization code flow, upstream OIDC login, refresh rotation, client auth, discovery, JWKS, Client ID Metadata Documents, private key JWT. |
| Security | Duplicate auth headers, diagnostics redaction, rate limits, storage permissions. |
| Tools | OpenAPI export and client secret generation. |

Identity provider test harness behavior is covered in [Identity Provider Testing](identity-provider-testing.md).

## Harness Components

| Helper | Purpose |
| --- | --- |
| `test/support/upstream-oidc.ts` | Starts a local OIDC provider with authorize, token, and userinfo endpoints. |
| `test/support/service-process.ts` | Starts Encore on a free local port with isolated state. |
| `test/support/oauth-client.ts` | Performs discovery, authorization code flow, token exchange, refresh, and ID token validation. |
| `test/support/mcp.ts` | Initializes MCP sessions, sends JSON-RPC messages, and calls tools. |
| `test/support/http.ts` | Reads HTTP responses and validates required response values. |

## Targeted Test Selection

Use the changed surface to select tests:

| Changed area | Test target |
| --- | --- |
| OAuth runtime behavior | `test/oauth/*.test.ts` and affected config tests. |
| Upstream identity provider behavior | `test/oauth/upstream-oidc-bridge.test.ts` and `test/config/user-profile.test.ts`. |
| MCP transport or tools | Affected `test/mcp/*.test.ts` files. |
| Actions endpoints or schema | Affected `test/actions/*.test.ts` files. |
| Shared response shape | Affected OAuth, MCP, Actions, and OpenAPI tests. |
| Security boundary | Affected `test/security/*.test.ts` plus the surface test that owns the boundary. |
| CDK deployment behavior | `npm --prefix ci/cdk test`. |
| Repository boundaries | `npm run check:dependencies`, `npm run check:architecture`, `npm run check:file-scope`, and `npm run check:test-placement`. |

Documentation tests are intentionally absent. Documentation quality is reviewed by reading the files directly.

## Release Gate

Run the full gate before a release or source archive:

```sh
npm run check
```

Use [Local End-To-End Scenarios](../user-guides/local-end-to-end.md) for developer evidence across OAuth, MCP, and Actions.

Use [Change Readiness](change-readiness.md) before committing, building, or releasing a completed slice.

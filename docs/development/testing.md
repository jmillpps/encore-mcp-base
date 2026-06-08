# Testing

The test suite proves live service behavior, protocol contracts, security boundaries, and repository structure.

## Common Commands

Run targeted tests while developing:

```sh
node --experimental-strip-types --test --test-concurrency=1 test/mcp/transport-bearer.test.ts
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

Documentation tests are intentionally absent. Documentation quality is reviewed by reading the files directly.

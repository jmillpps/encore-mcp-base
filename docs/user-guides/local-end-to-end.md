# Local End-To-End Scenarios

Use these scenarios to prove a local checkout works across health, discovery, OAuth, MCP, Actions, and state reset paths.

## Start The Service

Install dependencies and run Encore from the repository root:

```sh
npm install
npm run dev
```

The local service listens on `http://localhost:4000`.

## Public Endpoint Checks

Run these checks from a second terminal:

```sh
curl http://localhost:4000/health
curl http://localhost:4000/.well-known/openid-configuration
curl http://localhost:4000/.well-known/oauth-protected-resource/mcp
curl http://localhost:4000/actions/openapi.json
```

Evidence for this step is:

- Health status `ok`.
- Discovery metadata with OAuth endpoints.
- MCP protected resource metadata with scopes.
- OpenAPI JSON with Actions paths.

## Local OAuth Flow

Automated tests perform the complete local OAuth flow with a per-test upstream OIDC provider. Use this test when validating the generic identity provider bridge:

```sh
node --experimental-strip-types --test --test-concurrency=1 test/oauth/upstream-oidc-bridge.test.ts
```

Evidence for this step is a passing test that starts the upstream provider, follows redirects, exchanges tokens, reads userinfo, and validates the service-issued identity.

## MCP Scenario

Run the focused MCP transport test:

```sh
node --experimental-strip-types --test --test-concurrency=1 test/mcp/streamable-http.test.ts
```

Evidence for this step is a passing test that initializes MCP, receives `MCP-Session-Id`, sends initialized notification, and exercises Streamable HTTP behavior.

Run the protected tool test:

```sh
node --experimental-strip-types --test --test-concurrency=1 test/mcp/protected-tools.test.ts
```

Evidence for this step is a passing test that proves protected tool auth, scope behavior, and structured tool output.

## Actions Scenario

Run the authenticated Actions test:

```sh
node --experimental-strip-types --test --test-concurrency=1 test/actions/authenticated-actions.test.ts
```

Evidence for this step is a passing test that obtains an Actions-audience token and calls protected Actions endpoints.

Run the OpenAPI compatibility test:

```sh
node --experimental-strip-types --test --test-concurrency=1 test/actions/openapi-compatibility.test.ts
```

Evidence for this step is a passing test that checks the generated schema against ChatGPT Actions compatibility rules.

## State Reset

Stop the local service before resetting local state:

```sh
rm -f var/oauth-store.json var/oauth-store.json.lock
```

Start the service again and rerun the public endpoint checks.

## Completion Evidence

A complete local verification record includes:

- Command names.
- Pass or fail result.
- Service origin.
- Test files run.
- Endpoint URLs checked.
- Any safe error code observed during troubleshooting.

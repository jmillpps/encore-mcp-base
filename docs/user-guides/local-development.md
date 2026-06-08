# Local Development

This guide starts the service locally, confirms the public health endpoint, and exports the Actions OpenAPI document. It is the shortest path to a working development environment.

## Prerequisites

Install Node.js, npm, and the Encore CLI. The repository uses TypeScript and Encore. Runtime dependency usage stays intentionally small.

Confirm the tools are available:

```sh
node --version
npm --version
encore version
```

Run commands from the repository root:

```sh
npm install
npm run dev
```

The development server listens on `http://localhost:4000` by default. Local development supplies default URLs, local OAuth clients, a local upstream OIDC provider, generated signing keys, and `var/oauth-store.json`.

Keep the development server running in one terminal. Use a second terminal for verification commands.

## Verify The Service

Use the health endpoint first:

```sh
curl http://localhost:4000/health
```

Expected response:

```json
{
  "status": "ok",
  "time": "2026-06-07T00:00:00.000Z",
  "service": "gpt-mcp-service"
}
```

The timestamp changes on each request.

Check OIDC discovery next:

```sh
curl http://localhost:4000/.well-known/openid-configuration
```

The response includes the issuer, authorization endpoint, token endpoint, JWKS URI, userinfo endpoint, supported grants, supported scopes, and PKCE methods.

Check MCP protected resource metadata:

```sh
curl http://localhost:4000/.well-known/oauth-protected-resource/mcp
```

The response advertises the local MCP resource and supported MCP scopes.

## Export OpenAPI

Generate the Actions schema:

```sh
node --experimental-strip-types tools/export-openapi.ts \
  --base-url http://localhost:4000 \
  --out var/actions.openapi.json
```

The export command validates the Encore route graph and the ChatGPT Actions compatibility rules before writing JSON.

Inspect the output file:

```sh
head -40 var/actions.openapi.json
```

The document includes `/health`, `/actions/profile`, `/actions/session`, OAuth authorization code flow, and JSON response schemas.

## Local OAuth Clients

Development mode includes three local clients:

- `local-test` supports both Actions and MCP resources for automated tests.
- `gpt-actions` supports GPT Actions account linking.
- `gpt-apps-mcp` supports GPT Apps MCP account linking and requires PKCE.

The default scopes are `openid`, `profile`, and `email`.

These clients are development fixtures. Production clients live in `OAUTH_CLIENTS_JSON`.

## Local Endpoints

Use these local URLs during development:

| Surface | URL |
| --- | --- |
| Health | `http://localhost:4000/health` |
| Actions profile | `http://localhost:4000/actions/profile` |
| Actions session | `http://localhost:4000/actions/session` |
| OAuth authorize | `http://localhost:4000/oauth/authorize` |
| OAuth token | `http://localhost:4000/oauth/token` |
| MCP Streamable HTTP | `http://localhost:4000/mcp` |
| Legacy SSE | `http://localhost:4000/sse` |

## Reset Local State

Local OAuth state lives in `var/oauth-store.json`. Stop the service before resetting the file:

```sh
rm -f var/oauth-store.json var/oauth-store.json.lock
```

The service recreates the store on the next OAuth or MCP state write.

## Targeted Checks

For documentation-only changes, run whitespace and structural checks. For runtime changes, run the affected test file first:

```sh
git diff --check
node --experimental-strip-types --test --test-concurrency=1 test/mcp/transport-bearer.test.ts
```

Run the full gate before release:

```sh
npm run check
```

## Development Loop

Use a small loop while changing runtime behavior:

1. Start the service with `npm run dev`.
2. Change one capability, endpoint, transport path, or security rule.
3. Run the narrow test file that exercises that behavior.
4. Inspect `git status --short`.
5. Commit the finished slice after the targeted check passes.

Keep documentation updates in `docs/` and keep service tests tied to live service behavior.

## Next Steps

Use [GPT Apps Setup](gpt-apps.md) for MCP. Use [GPT Actions Setup](gpt-actions.md) for REST Actions. Use [Testing](../development/testing.md) before committing service changes.

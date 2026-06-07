# OpenAPI Contract

The OpenAPI document is the stable GPT Actions contract exported from the service.

## Document Shape

| Section | Content |
| --- | --- |
| `openapi` | Version `3.1.0`. |
| `info` | Service title, description, and version. |
| `servers` | Public service origin. |
| `paths` | Health, profile, and session Actions operations. |
| `components.securitySchemes` | OAuth2 authorization code flow. |
| `components.schemas` | JSON response and error schemas. |

## Paths

| Path | Operation ID | Security |
| --- | --- | --- |
| `GET /health` | `getServiceHealth` | none |
| `GET /actions/profile` | `getAuthenticatedProfile` | `openid profile email` |
| `GET /actions/session` | `getAuthenticatedSession` | `openid` |

## Actions Requirements

Each protected operation declares OAuth2 scopes and `401` plus `403` responses. Each operation uses JSON content, a stable operation ID, and `x-openai-isConsequential: false`.

The OAuth authorization URL and token URL share the same origin as the declared server. Public exports use HTTPS.

## Export Command

```sh
node --experimental-strip-types tools/export-openapi.ts \
  --base-url https://service.example.com \
  --out var/actions.openapi.json
```

The command validates the route graph and compatibility rules before writing output.

## Export Options

| Option | Required | Description |
| --- | --- | --- |
| `--base-url` | optional | Service origin used for `servers`, authorization URL, and token URL. Defaults to `PUBLIC_ISSUER_URL` or local development URL. |
| `--out` | optional | JSON output path inside the project. |
| `--no-build` | optional | Reuse an existing Encore route graph. |

Output paths must stay inside the project and end with `.json`.

# OpenAPI Contract

The OpenAPI document is the stable GPT Actions contract served by the service and exported by the local tooling.

## Document Shape

| Section | Content |
| --- | --- |
| `openapi` | Version `3.1.0`. |
| `info` | Service title, description, and version. |
| `servers` | Public service origin. |
| `x-source` | Fixed value `manual-actions-document`. |
| `x-route-graph-verification` | Fixed value `encore-check`. |
| `paths` | Health, profile, and session Actions operations. |
| `components.securitySchemes` | OAuth2 authorization code flow. |
| `components.schemas` | JSON response and error schemas. |

## Paths

| Path | Operation ID | Security |
| --- | --- | --- |
| `GET /health` | `getServiceHealth` | none |
| `GET /actions/profile` | `getAuthenticatedProfile` | `openid profile email` |
| `GET /actions/session` | `getAuthenticatedSession` | `openid` |

`GET /actions/openapi.json` serves the document. The schema endpoint is public and read-only.

The schema endpoint returns `application/json; charset=utf-8` with `Cache-Control: public, max-age=300`.

## Actions Requirements

Each protected operation declares OAuth2 scopes and `401` plus `403` responses. Each operation uses JSON content, a stable operation ID, and `x-openai-isConsequential: false`.

The OAuth authorization URL and token URL share the same origin as the declared server. Public exports use HTTPS.

## Compatibility Checks

| Check | Requirement |
| --- | --- |
| Version | The document uses OpenAPI `3.1.0`. |
| Operations | Every operation has a unique operation ID, summary, description, and consequential flag. |
| OAuth | Protected Actions operations declare OAuth2 scopes from the authorization code flow. |
| Error responses | Protected Actions operations declare `401` and `403`. |
| Headers | Operations omit custom header parameters. |
| Media types | Request and response bodies use `application/json`. |
| Schemas | Component schemas and properties include descriptions. |
| Origins | OAuth authorization and token URLs share the server origin. |

## Export Command

```sh
node --experimental-strip-types tools/export-openapi.ts \
  --base-url https://service.example.com \
  --out var/actions.openapi.json
```

The command validates the route graph and compatibility rules before writing output.

The OpenAPI document is maintained in `actions/openapi-document.ts`. The export command verifies the Encore route graph before writing an artifact. The public endpoint serves the same document builder at runtime.

## Export Options

| Option | Required | Description |
| --- | --- | --- |
| `--base-url` | optional | Service origin used for `servers`, authorization URL, and token URL. Defaults to `PUBLIC_ISSUER_URL` or local development URL. |
| `--out` | optional | JSON output path inside the project. |
| `--no-build` | optional | Reuse an existing Encore route graph. |

Output paths must stay inside the project and end with `.json`.

## URL Import

Use this URL shape for GPT Actions import:

```text
https://service.example.com/actions/openapi.json
```

The endpoint uses the configured issuer for `servers`, authorization URL, and token URL.

The import URL is safe to expose publicly. Protected Actions endpoints still require OAuth access tokens with the Actions audience.

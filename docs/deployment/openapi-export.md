# OpenAPI Export

The OpenAPI document is the GPT Actions contract. The service serves the same document at `GET /actions/openapi.json` for URL import.

## Public URL Import

Use the deployed schema URL in ChatGPT:

```text
https://service.example.com/actions/openapi.json
```

The endpoint is public, read-only, and cacheable for five minutes. It uses `PUBLIC_ISSUER_URL` for the OpenAPI `servers` entry, OAuth authorization URL, and OAuth token URL.

## Command

```sh
node --experimental-strip-types tools/export-openapi.ts \
  --base-url https://service.example.com \
  --out var/actions.openapi.json
```

Options:

| Option | Purpose |
| --- | --- |
| `--base-url` | Public service origin used in OpenAPI servers and OAuth URLs. |
| `--out` | JSON output path inside the project. |
| `--no-build` | Skip Encore graph build when a valid graph already exists. |

## Validation

The exporter validates:

- Encore route graph availability.
- OpenAPI version.
- Info fields.
- Operation IDs.
- OAuth2 authorization code flow.
- Declared and required scopes.
- JSON content types.
- Response schemas.
- ChatGPT production limits.
- Output path safety.

## Output Rules

The output path must stay inside the project and end with `.json`. Public base URLs use HTTPS and public hosts. Localhost HTTP is accepted for development exports.

## Endpoint Verification

Verify the deployed endpoint before importing it into ChatGPT:

```sh
curl https://service.example.com/actions/openapi.json
```

The response content type is `application/json; charset=utf-8`.

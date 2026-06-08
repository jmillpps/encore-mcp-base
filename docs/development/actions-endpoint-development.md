# Actions Endpoint Development

Use this guide when adding or changing a GPT Actions REST endpoint.

## File Placement

Place endpoint files under `actions/`. Keep public route definitions small. Move shared behavior outside `actions/` when MCP also needs the behavior.

Current endpoint files use this shape:

| File | Route |
| --- | --- |
| `actions/endpoints.health.ts` | `GET /health` |
| `actions/endpoints.privacy.ts` | `GET /privacy` |
| `actions/endpoints.openapi.ts` | `GET /actions/openapi.json` |
| `actions/endpoints.profile.ts` | `GET /actions/profile` |
| `actions/endpoints.session.ts` | `GET /actions/session` |

## Route Contract

Protected endpoints declare `auth: true`, read the `Authorization` header, reject `access_token` query parameters, validate the Actions audience, and enforce endpoint scopes.

Public endpoints stay read-only. The current public endpoints are health, privacy, and OpenAPI.

## Implementation Files

| Concern | Owning file | Developer action |
| --- | --- | --- |
| Bearer validation | `actions/action-bearer.ts` | Reuse `verifyActionBearer` for every protected Actions endpoint. |
| Authorization header shape | `actions/authorization-header-middleware.ts` | Keep duplicate header handling aligned with shared auth parsing. |
| Endpoint adapter | `actions/endpoints.*.ts` | Keep the route small and move shared behavior to the owning domain module. |
| OpenAPI document | `actions/openapi-document.ts` | Add or update the operation, schema, OAuth security entry, and compatibility metadata. |
| OpenAPI export | `tools/export-openapi.ts` | Verify generated schema output when deployment or URL rules change. |
| OpenAPI compatibility | `tools/openapi-actions-compatibility.ts` | Add compatibility checks when a new Actions pattern is introduced. |

## Bearer Validation

Use `verifyActionBearer` from `actions/action-bearer.ts` for protected endpoints. It validates the token against `ACTIONS_AUDIENCE` and maps service auth failures to Encore auth errors.

Use `rejectActionAccessTokenQuery` for every Actions endpoint that accepts a query object. Access tokens travel in the `Authorization` header.

## Public Endpoint Rules

Public Actions-adjacent endpoints support setup and import:

| Endpoint | Rule |
| --- | --- |
| `GET /health` | Return simple service metadata through the typed Encore handler. |
| `GET /privacy` | Return public policy text with a text content type and public cache header. |
| `GET /actions/openapi.json` | Return the generated OpenAPI document with JSON content type and public cache header. |

Public endpoints must avoid user-specific data, token-derived data, and mutable side effects.

## Response Models

Define response interfaces close to the endpoint when the response belongs to that route. Reuse shared types such as `UserProfile` when the same model is returned from OAuth, MCP, and Actions.

Responses should use explicit fields, stable names, and JSON-compatible values.

## Error Handling

Actions callers receive Encore-shaped errors. Keep error fields useful to the caller and safe for logs:

| Failure | Expected handling |
| --- | --- |
| Missing bearer token | Return an authentication error before endpoint behavior runs. |
| Malformed or expired token | Return an authentication error and emit safe diagnostics. |
| Wrong audience | Reject the token through Actions bearer validation. |
| Missing scope | Return an authorization error from the endpoint boundary. |
| Query access token | Reject the request before token validation. |
| Handler failure | Return a safe service error and keep raw secrets out of diagnostics. |

## OpenAPI Registration

Update `actions/openapi-document.ts` for every Actions endpoint change.

The OpenAPI operation should include:

- Stable `operationId`.
- Clear `summary`.
- Clear `description`.
- OAuth security scopes for protected endpoints.
- `x-openai-isConsequential: false` for read-only operations.
- JSON response schema.
- `ErrorResponse` entries for protected endpoints.

Run OpenAPI compatibility tests after changing the document builder.

## Test Requirements

Actions tests should prove:

- Public endpoints return the documented response.
- Protected endpoints reject missing bearer tokens.
- Protected endpoints reject wrong-audience bearer tokens.
- Protected endpoints reject missing scopes.
- Query access tokens are rejected.
- Successful responses match the OpenAPI schema.
- The generated document and `/actions/openapi.json` stay aligned.

Use `test/support/service-process.ts` to start a live service and `test/support/oauth-client.ts` to obtain account-linked tokens.

## Completion Checklist

Before committing an Actions endpoint change:

1. Confirm the endpoint file owns only transport input, auth, and response mapping.
2. Confirm shared behavior lives outside `actions/` when MCP also uses it.
3. Confirm the OpenAPI operation describes the live route and response shape.
4. Confirm public endpoints return only public data.
5. Confirm protected endpoints reject missing, malformed, wrong-audience, and under-scoped tokens.
6. Confirm targeted Actions tests pass.
7. Confirm affected API, architecture, user-guide, and deployment docs are updated.

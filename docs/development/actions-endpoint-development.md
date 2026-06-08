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

## Bearer Validation

Use `verifyActionBearer` from `actions/action-bearer.ts` for protected endpoints. It validates the token against `ACTIONS_AUDIENCE` and maps service auth failures to Encore auth errors.

Use `rejectActionAccessTokenQuery` for every Actions endpoint that accepts a query object. Access tokens travel in the `Authorization` header.

## Response Models

Define response interfaces close to the endpoint when the response belongs to that route. Reuse shared types such as `UserProfile` when the same model is returned from OAuth, MCP, and Actions.

Responses should use explicit fields, stable names, and JSON-compatible values.

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

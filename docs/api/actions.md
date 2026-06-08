# Actions API Reference

GPT Actions use REST endpoints and OpenAPI 3.1.

## Authentication

Protected Actions endpoints require:

| Requirement | Value |
| --- | --- |
| Header | `Authorization: Bearer <access_token>` |
| Audience | `ACTIONS_AUDIENCE` |
| Token algorithm | RS256 |
| Query token policy | `access_token` query parameters are rejected. |

The OAuth flow for Actions uses `/oauth/authorize` and `/oauth/token`. GPT Actions clients may omit `resource` when their client record has one Actions audience.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | none | Return service reachability. |
| `GET` | `/privacy` | none | Return the public privacy policy. |
| `GET` | `/actions/openapi.json` | none | Return the GPT Actions OpenAPI document. |
| `GET` | `/actions/profile` | `openid profile email` | Return the authenticated profile. |
| `GET` | `/actions/session` | `openid` | Return token session metadata. |

## Requests

| Endpoint | Headers | Query | Body |
| --- | --- | --- | --- |
| `GET /health` | none | none | none |
| `GET /privacy` | none | none | none |
| `GET /actions/openapi.json` | none | none | none |
| `GET /actions/profile` | `Authorization` | none | none |
| `GET /actions/session` | `Authorization` | none | none |

## Health Response

Status `200` returns:

| Field | Type | Description |
| --- | --- | --- |
| `status` | string | Fixed value `ok`. |
| `service` | string | Service identifier. |
| `time` | string | ISO timestamp for the response. |

## Privacy Response

Status `200` returns a plain text privacy policy for GPT configuration.

## OpenAPI Response

Status `200` returns the GPT Actions OpenAPI 3.1 document as JSON. The document declares the public server URL, OAuth authorization code URLs, read-only Actions operations, required scopes, response schemas, and `x-openai-isConsequential: false`.

The endpoint is public and read-only. The response is cacheable for five minutes.

## Profile Response

Status `200` returns:

| Field | Type | Description |
| --- | --- | --- |
| `sub` | string | Stable subject identifier. |
| `given_name` | string | Given name. |
| `family_name` | string | Family name. |
| `name` | string | Full display name. |
| `preferred_username` | string | Preferred username. |
| `email` | string | Verified email address. |
| `email_verified` | boolean | Email verification status. |

## Session Response

Status `200` returns:

| Field | Type | Description |
| --- | --- | --- |
| `subject` | string | Token subject. |
| `clientId` | string | OAuth client ID. |
| `audience` | string | Accepted token audience. |
| `scopes` | string[] | Granted OAuth scopes. |

## Error Responses

Protected endpoints return the live Encore error shape:

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `invalid_argument` | Query token use or malformed input. |
| `401` | `unauthenticated` | Missing, invalid, expired, or wrong-audience bearer token. |
| `403` | `permission_denied` | Valid token missing a required scope. |

Error bodies contain:

| Field | Type | Description |
| --- | --- | --- |
| `code` | string | Stable Encore error code. |
| `message` | string | Safe caller-facing message. |
| `details` | object or null | Structured details when available. |
| `internal_message` | string or null | Nullable field retained by the live contract. |

## OpenAPI

The OpenAPI document declares OAuth authorization code flow, operation IDs, JSON response schemas, required OAuth scopes, and `x-openai-isConsequential: false` for current read-only operations.

Use `GET /actions/openapi.json` for GPT Actions URL import. Use the export command when a file upload workflow is required.

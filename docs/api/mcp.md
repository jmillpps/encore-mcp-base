# MCP API Reference

The service implements MCP protocol baseline `2025-11-25`.

## Authentication

MCP request endpoints require an MCP-audience bearer token:

| Requirement | Value |
| --- | --- |
| Header | `Authorization: Bearer <access_token>` |
| Audience | `MCP_RESOURCE_URL` |
| Token algorithm | RS256 |
| Query token policy | `access_token` query parameters are rejected. |

`POST /mcp`, `GET /mcp`, `DELETE /mcp`, `GET /sse`, and `POST /messages` require the bearer token. `OPTIONS /mcp` validates origin, query token policy, and duplicate authorization header shape before returning CORS metadata.

Protected tools and protected resources also enforce scopes. Tool scope failures return a ChatGPT-compatible challenge in the `WWW-Authenticate` transport header and in the tool result metadata. Resource scope failures return a JSON-RPC error with the same transport header.

## Streamable HTTP

| Method | Path | Required headers | Response |
| --- | --- | --- | --- |
| `OPTIONS` | `/mcp` | `Origin` when browser initiated | Empty CORS response. |
| `POST` | `/mcp` | `Authorization`, `Accept`, `Content-Type` | JSON response or `202`. |
| `GET` | `/mcp` | `Authorization`, `Accept`, `MCP-Session-Id` | SSE stream. |
| `DELETE` | `/mcp` | `Authorization`, `MCP-Session-Id` | Empty response. |

`POST /mcp` requires `Accept: application/json, text/event-stream` and JSON content. `GET /mcp` requires `Accept: text/event-stream`.

## Streamable HTTP Status Codes

| Status | Applies to | Meaning |
| --- | --- | --- |
| `200` | `POST /mcp` | JSON-RPC response body. |
| `202` | `POST /mcp` | Notification or client response accepted. |
| `204` | `OPTIONS /mcp`, `DELETE /mcp` | Request completed with no body. |
| `400` | all `/mcp` methods | Invalid headers, session ID, protocol version, JSON body, or query token use. |
| `401` | `POST /mcp`, `GET /mcp`, `DELETE /mcp` | Missing or invalid MCP bearer token. |
| `403` | transport validation | Disallowed browser origin. |
| `404` | session-bound requests | Unknown, expired, or terminated MCP session. |
| `429` | SSE and request ID paths | Connection limit or request ID limit reached. |

Initialize responses include `MCP-Session-Id`. Session-bound `POST`, `GET`, and `DELETE` requests send that value in the `MCP-Session-Id` header.

Tool scope failures use a successful JSON-RPC response containing an auth challenge result. Resource scope failures use a successful JSON-RPC error response. Both responses include `WWW-Authenticate`.

## Legacy HTTP/SSE

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/sse` | Open an SSE stream and receive an endpoint event. |
| `POST` | `/messages?sessionId=...` | Send JSON-RPC messages for the legacy session. |

Legacy SSE sessions are process-bound. Production routing keeps each `/messages` request on the same service instance as its `/sse` stream.

## Auth Challenges

Transport auth failures return `WWW-Authenticate` with:

- `error`
- `error_description`
- `resource_metadata`
- `scope`

Protected tool scope failures return the same challenge in both the HTTP header and tool result `_meta["mcp/www_authenticate"]`.

## JSON-RPC Methods

| Method | Params | Result |
| --- | --- | --- |
| `initialize` | `protocolVersion`, `capabilities`, `clientInfo` | Protocol version, server capabilities, server info, instructions. |
| `notifications/initialized` | optional `_meta` | `202 Accepted`. |
| `ping` | optional `_meta` | Empty object. |
| `tools/list` | optional `_meta`, optional cursor | Tool descriptor list. |
| `tools/call` | `name`, optional `arguments`, optional `_meta`, optional `task` | Tool result envelope. |
| `resources/list` | optional `_meta`, optional cursor | Resource descriptor list. |
| `resources/templates/list` | optional `_meta`, optional cursor | Resource template descriptor list. |
| `resources/read` | `uri`, optional `_meta` | Resource contents. |

Unsupported methods return JSON-RPC code `-32601`. Invalid params return `-32602`. Calls made before initialization return `-32002` except `initialize`, `ping`, and `notifications/initialized`.

## Tools

All current tools use an empty input object.

| Tool | Scopes | Structured output |
| --- | --- | --- |
| `health.check` | none | `status`, `timestamp`, `service.name`, `service.version`. |
| `health.status_card` | none | `status`, `timestamp`, `service.name`, `service.version` for inline UI rendering. |
| `identity.profile` | `openid profile email` | `sub`, `given_name`, `family_name`, `name`, `preferred_username`, `email`, `email_verified`. |
| `identity.profile_card` | `openid profile email` | Authenticated profile fields for inline UI rendering. |
| `auth.session` | `openid` | `subject`, `clientId`, `audience`, `scopes`. |

Tool result resource URIs use `https`, `http`, or `ui` schemes.

## Resources

The server advertises `capabilities.resources` during initialization. Resource subscriptions and list-change notifications are absent in the current capability advertisement.

Current resources:

| Resource URI | MIME type | Scopes | Purpose |
| --- | --- | --- | --- |
| `ui://widget/health-status-card-v1.html` | `text/html;profile=mcp-app` | none | ChatGPT-rendered service health card. |
| `ui://widget/profile-summary-card-v1.html` | `text/html;profile=mcp-app` | `openid profile email` | ChatGPT-rendered authenticated profile card. |

`resources/list` returns descriptors with URI, name, title, description, and MIME type. `resources/templates/list` returns the registered template list. The current implementation has no parameterized resource templates.

`resources/read` validates the URI, enforces resource scopes, applies the MCP resource read rate limit, and returns one or more content objects. UI resources return HTML text content with `_meta.ui` metadata and ChatGPT compatibility aliases.

UI resource metadata includes:

- `_meta.ui.prefersBorder`
- `_meta.ui.csp`
- `_meta.ui.domain`
- `_meta["openai/widgetDescription"]`
- `_meta["openai/widgetPrefersBorder"]`
- `_meta["openai/widgetCSP"]`
- `_meta["openai/widgetDomain"]`

Render tools include `_meta.ui.resourceUri` and `_meta["openai/outputTemplate"]` in their descriptors.

## JSON-RPC Behavior

Requests return JSON-RPC responses. Notifications and client responses return `202 Accepted` with an empty body.

Malformed JSON, invalid UTF-8, oversized bodies, invalid IDs, invalid params, and unsupported fields return protocol errors. Duplicate request IDs within a session are rejected.

## Session Headers

| Header | Direction | Rule |
| --- | --- | --- |
| `MCP-Session-Id` | Response from `initialize`; request header for session-bound calls. | Session IDs use URL-safe token characters and are stored as hashes. |
| `MCP-Protocol-Version` | Request header. | Optional during initialization and later requests. When present after initialization, it must match the stored session protocol version. |
| `Last-Event-ID` | Request header allowed by CORS. | Reserved for MCP client compatibility. |

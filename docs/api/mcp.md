# MCP API Reference

The service implements MCP protocol baseline `2025-11-25`.

## Authentication

All MCP transport endpoints require an MCP-audience bearer token:

| Requirement | Value |
| --- | --- |
| Header | `Authorization: Bearer <access_token>` |
| Audience | `MCP_RESOURCE_URL` |
| Token algorithm | RS256 |
| Query token policy | `access_token` query parameters are rejected. |

Protected tools also enforce tool scopes. Scope failures return a ChatGPT-compatible challenge in the transport header and in the tool result metadata.

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
| `401` | all `/mcp` methods | Missing or invalid MCP bearer token. |
| `403` | all `/mcp` methods | Valid token missing required scope. |
| `404` | session-bound requests | Unknown, expired, or terminated MCP session. |
| `429` | SSE and request ID paths | Connection limit or request ID limit reached. |

Initialize responses include `MCP-Session-Id`. Session-bound `POST`, `GET`, and `DELETE` requests send that value in the `MCP-Session-Id` header.

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

Unsupported methods return JSON-RPC code `-32601`. Invalid params return `-32602`. Calls made before initialization return `-32002` except `initialize`, `ping`, and `notifications/initialized`.

## Tools

All current tools use an empty input object.

| Tool | Scopes | Structured output |
| --- | --- | --- |
| `health.check` | none | `status`, `timestamp`, `service.name`, `service.version`. |
| `identity.profile` | `openid profile email` | `sub`, `given_name`, `family_name`, `name`, `preferred_username`, `email`, `email_verified`. |
| `auth.session` | `openid` | `subject`, `clientId`, `audience`, `scopes`. |

Tool result resource URIs use `https`, `http`, or `ui` schemes.

## JSON-RPC Behavior

Requests return JSON-RPC responses. Notifications and client responses return `202 Accepted` with an empty body.

Malformed JSON, invalid UTF-8, oversized bodies, invalid IDs, invalid params, and unsupported fields return protocol errors. Duplicate request IDs within a session are rejected.

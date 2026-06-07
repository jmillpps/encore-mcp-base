# MCP Transports

The service supports MCP protocol baseline `2025-11-25`.

## Streamable HTTP

Streamable HTTP is the primary GPT Apps transport.

| Method | Path | Purpose |
| --- | --- | --- |
| `OPTIONS` | `/mcp` | Return CORS metadata for browser clients. |
| `POST` | `/mcp` | Receive JSON-RPC requests, notifications, and client responses. |
| `GET` | `/mcp` | Open the SSE receive stream for an active session. |
| `DELETE` | `/mcp` | Terminate an active session. |

Every `/mcp` request requires an MCP-audience bearer token. `POST /mcp` validates the bearer token before JSON body parsing and before session creation.

Initialize creates the session and returns `MCP-Session-Id`. Later session-bound requests send `MCP-Session-Id`. Session requests may omit `MCP-Protocol-Version`; the service uses the version stored with the session.

## Legacy HTTP/SSE

Legacy support uses:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/sse` | Open an SSE receive stream and receive a `/messages` endpoint event. |
| `POST` | `/messages` | Send JSON-RPC messages for the active legacy SSE session. |

Legacy sessions are process-bound. Production routing must keep `/messages` requests on the same service instance as the matching `/sse` connection.

## JSON-RPC Rules

The transport accepts one JSON-RPC message per HTTP request. Request IDs are strings or safe integers. Params must be objects when present.

The parser rejects response/request field collisions, unsupported envelope fields, invalid UTF-8, malformed JSON, unsafe numeric IDs, invalid response result shapes, and notification forms for request-only methods.

## SSE Lifetime

SSE streams stay open for later server-originated messages and heartbeats. Connection counts are bounded by `MCP_SSE_MAX_CONNECTIONS`.

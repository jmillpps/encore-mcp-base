# MCP Transports

The service supports MCP protocol baseline `2025-11-25`. Streamable HTTP at `/mcp` is the primary GPT Apps transport. Legacy HTTP/SSE remains available through `/sse` and `/messages`.

## Streamable HTTP

| Method | Path | Purpose |
| --- | --- | --- |
| `OPTIONS` | `/mcp` | Return CORS metadata for browser clients. |
| `POST` | `/mcp` | Receive JSON-RPC requests, notifications, and client responses. |
| `GET` | `/mcp` | Open the SSE receive stream for an active session. |
| `DELETE` | `/mcp` | Terminate an active session. |

Every `/mcp` request validates transport input before protocol behavior runs.

| Validation step | Applied to | Behavior |
| --- | --- | --- |
| Origin allowlist | All `/mcp` methods when `Origin` is present. | Rejects origins outside `ALLOWED_ORIGINS`. |
| Query bearer rejection | All `/mcp` methods. | Rejects `access_token` in the URL query string. |
| Authorization header cardinality | All `/mcp` methods. | Rejects duplicate `Authorization` headers. |
| MCP bearer validation | `POST /mcp`, `GET /mcp`, and `DELETE /mcp`. | Requires a token whose audience equals the configured MCP resource. |
| CORS metadata auth shape | `OPTIONS /mcp`. | Validates authorization header cardinality and returns CORS metadata. |
| `Accept` validation | `POST /mcp`, `GET /mcp`. | `POST` must accept both `application/json` and `text/event-stream`; `GET` must accept `text/event-stream`. |
| `Content-Type` validation | `POST /mcp`. | Requires `application/json` with UTF-8 semantics. |
| CORS response headers | All successful `/mcp` methods with an allowed origin. | Returns pinned methods and pinned request headers. |

`POST /mcp` validates the bearer token before JSON body parsing and before session creation. This keeps malformed or hostile JSON outside the protocol layer when authentication fails first.

Initialize creates the session and returns `MCP-Session-Id`. Later session-bound requests send `MCP-Session-Id`. Session requests may omit `MCP-Protocol-Version`; the service uses the version stored with the session.

## Streamable Session Lifecycle

| Step | Client action | Service behavior |
| --- | --- | --- |
| Initialize | `POST /mcp` with method `initialize`, no `MCP-Session-Id`, optional `MCP-Protocol-Version`. | Negotiates protocol version, validates client info, returns capabilities and instructions, creates a one-hour durable session, and returns `MCP-Session-Id`. |
| Initialized notification | `POST /mcp` with method `notifications/initialized` and `MCP-Session-Id`. | Marks the durable session as initialized. |
| Request processing | `POST /mcp` with session headers. | Touches the session, verifies protocol-version consistency when supplied, reserves request ID hashes, and dispatches JSON-RPC. |
| Receive stream | `GET /mcp` with session headers. | Touches the session and keeps an SSE stream open for server-originated messages and heartbeats. |
| Termination | `DELETE /mcp` with session headers. | Touches the session, marks it terminated, and returns no content. |

Sessions store a hash of the session ID, client ID, negotiated protocol version, creation time, last-seen time, expiration time, initialized time, terminated time, and request ID hashes. A session expires one hour after creation. Each session accepts up to 4096 unique request ID hashes.

Before the initialized notification is received, the session accepts `initialize`, `ping`, and `notifications/initialized`. Other methods return a JSON-RPC session initialization error.

## Legacy HTTP/SSE

Legacy support uses:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/sse` | Open an SSE receive stream and receive a `/messages` endpoint event. |
| `POST` | `/messages` | Send JSON-RPC messages for the active legacy SSE session. |

Legacy sessions are process-bound. Production routing must keep `/messages` requests on the same service instance as the matching `/sse` connection.

Legacy transport requests use the same origin checks, query-token rejection, duplicate authorization header rejection, MCP audience validation, JSON content validation, request ID replay protection, and tool authorization behavior as Streamable HTTP. The legacy receive stream emits an endpoint event that contains the session-specific `/messages` URL.

## JSON-RPC Rules

The transport accepts one JSON-RPC message per HTTP request. Request IDs are strings or safe integers. Params must be objects when present.

The parser rejects response/request field collisions, unsupported envelope fields, invalid UTF-8, malformed JSON, unsafe numeric IDs, invalid response result shapes, and notification forms for request-only methods.

| Method | Behavior |
| --- | --- |
| `initialize` | Returns protocol version, server info, server instructions, and tool capability metadata. |
| `ping` | Returns an empty JSON-RPC result. |
| `tools/list` | Returns validated tool descriptors. Cursors are currently rejected. |
| `tools/call` | Validates the tool name, argument object, scope requirements, input schema, output schema, and result envelope. |
| Client response envelopes | Return HTTP `202` without a JSON body. |
| Notifications | Return protocol-specific accepted responses when the notification is valid. |
| Unknown request methods | Return a JSON-RPC missing-method error. |

## SSE Lifetime

SSE streams stay open for later server-originated messages and heartbeats. The service writes an initial `ready` comment for Streamable HTTP and then writes heartbeat comments every 25 seconds. Connection counts are bounded by `MCP_SSE_MAX_CONNECTIONS`.

Operators should configure the reverse proxy and load balancer for long-lived HTTP responses. Health checks, OpenAPI exports, OAuth endpoints, and Actions endpoints are short-lived HTTP requests; MCP receive streams are long-lived connections.

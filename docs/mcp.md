# MCP

The service exposes MCP for GPT Apps through Streamable HTTP and legacy HTTP/SSE.

The protocol baseline is `2025-11-25`.

The first tool set includes a no-scope health tool, a protected identity profile tool, and a protected auth session tool.

Protected tools validate issuer, audience, expiry, client ID, and scopes on every call.

When a protected tool needs authentication, it returns a ChatGPT-compatible `mcp/www_authenticate` challenge.

Missing or invalid bearer tokens receive a Bearer challenge with `error="invalid_token"`, `error_description`, `resource_metadata`, and the required scope list.

Bearer challenges use the path-specific protected resource metadata URL for `/mcp`.

Protected resource metadata advertises the scopes used by current MCP tools.

Tokens with insufficient scopes receive a Bearer challenge with `error="insufficient_scope"`, `error_description`, `resource_metadata`, and the required scope list.

Tool names use ASCII letters, digits, underscores, hyphens, and dots. Names stay within 128 characters.

Tool descriptors use explicit risk annotations for read-only, destructive, idempotent, and open-world behavior.

Tool descriptors include per-tool ChatGPT Apps auth schemes.

Tool descriptors mirror auth schemes in `_meta.securitySchemes` for ChatGPT Apps clients that read descriptor metadata.

Tool descriptors set `_meta.ui.visibility` to `["model"]` for the current model-callable tool surface.

Tool descriptors include short ChatGPT Apps invocation status text under OpenAI metadata keys.

Tool descriptors are validated before they are listed or executed.

The current tool list is returned as a single page. `tools/list` accepts request metadata and rejects unsupported cursors with `-32602`.

Tool argument validation failures return tool execution errors with `isError: true`. Malformed `tools/call` request shapes and unknown tools return JSON-RPC protocol errors.

Tool results must use MCP `CallToolResult` content, structured content, error flag, and metadata shapes before leaving the tool boundary.

Tool result content blocks are validated against supported MCP content shapes.

Task-augmented tool calls run normally when task support is not advertised.

The service ignores `params.task` and `io.modelcontextprotocol/related-task` request metadata.

Tool descriptors declare task-augmented execution as forbidden.

Tool results with structured content include the same payload as serialized JSON text.

## Streamable HTTP

Streamable HTTP is served at `/mcp`.

`POST /mcp` accepts one JSON-RPC request, notification, or response per HTTP request.

JSON-RPC request and response identifiers are strings or numbers. Protocol errors omit `id` when no valid request identifier exists.

Numeric JSON-RPC identifiers must be finite safe integers.

MCP request methods require JSON-RPC identifiers.

JSON-RPC `params` values must be objects when present.

Supported MCP request methods reject unsupported parameter fields.

Request metadata uses `_meta`. `_meta.progressToken` values are strings or finite numbers.

JSON-RPC response `result` values must be objects.

Clients send `Accept: application/json, text/event-stream` and `Content-Type: application/json`.

JSON request bodies use UTF-8.

Bearer tokens use the `Authorization` header. MCP routes reject `access_token` URI query parameters.

MCP message transports require MCP-audience bearer tokens before JSON-RPC handling.

Initialize requests require MCP-audience bearer tokens before session creation.

Protected tool handlers validate issuer, audience, expiry, client ID, and scopes before returning protected data.

Streamable receive and DELETE transports require MCP-audience bearer tokens before opening or terminating sessions.

Client JSON objects must pass JSON-RPC message validation to reach transport response handling.

JSON-RPC request and notification objects cannot include response fields.

The initialize response includes `MCP-Session-Id`. Clients send that session ID with `MCP-Protocol-Version` on later `/mcp` requests.

Session-bound requests without `MCP-Protocol-Version` use the negotiated protocol version stored with the session.

Initialize requests start a new MCP session and do not include `MCP-Session-Id`.

Initialize requests must include `protocolVersion`, `capabilities`, and `clientInfo`.

Initialize requests accept request metadata and reject unsupported parameter fields.

Initialize client capabilities must use object-shaped known capability branches and boolean `roots.listChanged` when present.

Known initialize client capability branches reject unsupported nested fields. Custom top-level capability branches are accepted when their values are objects.

Initialize client metadata must use MCP implementation field shapes for optional title, description, website URL, and icons.

Initialize responses include server instructions for ChatGPT tool selection and OAuth scope expectations.

Clients send `notifications/initialized` before normal operation.

`ping` accepts request metadata and returns an empty result.

Accepted client notifications are `notifications/initialized`, `notifications/cancelled`, and `notifications/roots/list_changed`.

Cancellation notifications include a valid `requestId`.

The service negotiates unsupported declared protocol versions to `2025-11-25`.

Requests return JSON responses. Notifications and client responses return `202 Accepted` with an empty body.

`GET /mcp` opens an SSE receive stream for a valid session. The stream sends heartbeat comments and stays available for later server-originated messages.

SSE receive streams are bounded by `MCP_SSE_MAX_CONNECTIONS`.

`DELETE /mcp` terminates the session. Later requests for the terminated session return `404 not_found`.

## Legacy HTTP/SSE

Legacy HTTP/SSE is served through `/sse` and `/messages`.

`GET /sse` validates the origin and bearer token, then keeps the receive stream open. The first event is `endpoint`, and the event data is the session-bound `/messages` URI for client POSTs.

`POST /messages` requires the `sessionId` value from the endpoint event and an MCP-audience bearer token. Accepted JSON-RPC requests return `202 Accepted` with an empty body. The JSON-RPC response is delivered on the open SSE stream as a `message` event.

JSON-RPC notifications and client responses return `202 Accepted` and do not create SSE response events.

Malformed transport input returns an HTTP error from the POST request.

Legacy HTTP/SSE sessions are bound to the active process and active stream. Production routing must keep `/messages` requests on the same service instance as the matching `/sse` connection.

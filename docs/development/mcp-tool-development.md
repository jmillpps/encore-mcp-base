# MCP Tool Development

Use this guide when adding or changing a GPT Apps tool.

## File Placement

Place the tool adapter under `mcp/tools/`. Register it in `mcp/tool-registry.ts`. Keep shared capability behavior outside `mcp/` when GPT Actions also needs the behavior.

## Descriptor Contract

Every tool implements `McpTool` from `mcp/tool-types.ts`:

| Field | Purpose |
| --- | --- |
| `name` | Stable tool identifier. |
| `title` | Human-readable title. |
| `description` | ChatGPT-facing purpose statement. |
| `icons` | Optional icon metadata. |
| `inputSchema` | JSON object schema for arguments. |
| `outputSchema` | JSON object schema for structured output. |
| `annotations` | Read-only, destructive, idempotent, and open-world hints. |
| `invocation` | Status text for invocation start and completion. |
| `requiredScopes` | OAuth scopes required for protected execution. |
| `ui` | Optional render-resource metadata for ChatGPT Apps UI components. |
| `run` | Tool implementation. |

The registry validates descriptor shape, name uniqueness, scope syntax, schemas, annotations, icons, and invocation status text at runtime.

Tools that render inline components set `ui` with `toolUiResource`. The descriptor includes `_meta.ui.resourceUri`, `_meta.ui.visibility`, and `_meta["openai/outputTemplate"]`. Use [MCP Apps UI Resources](mcp-app-ui-resources.md) for the resource, metadata, scope, and test contract.

## Input And Output

Tool input schemas use helpers from `mcp/tool-schemas.ts`. Current tools use an empty object input schema.

Tool output returns a tool result envelope with:

- `content` for model-visible text.
- `structuredContent` for schema-validated data.
- `isError` for caller-safe tool failures.

The registry validates successful `structuredContent` against the advertised `outputSchema`. A schema mismatch is a service error and should fail tests.

## Tool Execution Path

| Step | Runtime owner | Expected behavior |
| --- | --- | --- |
| Transport auth | `mcp/endpoints.mcp.ts` or `mcp/endpoints.sse.ts` | Validate MCP-audience bearer tokens before protected protocol behavior. |
| JSON-RPC validation | `mcp/json-rpc.ts`, `mcp/request-body.ts`, `mcp/request-params.ts` | Reject malformed request shape and unsupported parameter shape. |
| Lifecycle validation | `mcp/lifecycle.ts` | Enforce initialization and method ordering. |
| Tool lookup | `mcp/tool-registry.ts` | Resolve the tool by exact name and validate descriptor integrity. |
| Argument validation | `mcp/tool-execution.ts` and schema helpers | Validate tool arguments before running capability code. |
| Scope enforcement | `mcp/tool-security.ts` | Enforce required scopes for protected tools. |
| Result validation | `mcp/tool-result.ts` | Validate structured output against the descriptor schema. |

## Authentication And Scopes

Every transport request uses an MCP-audience bearer token. Protected tools also call `verifyBearer` with the tool scopes. Scope failures return a `WWW-Authenticate` challenge and `_meta["mcp/www_authenticate"]` in the tool result.

Use scope arrays from `auth/scopes.ts` when a scope set is shared with Actions or OAuth docs.

## Auth Challenge Behavior

| Failure | Expected MCP behavior |
| --- | --- |
| Missing or malformed transport bearer | Transport returns an HTTP auth challenge. |
| Wrong token audience | Transport rejects the request before JSON-RPC dispatch. |
| Missing tool scope | Tool result uses a caller-safe error envelope and includes `_meta["mcp/www_authenticate"]`. |
| Tool runtime rejection | Tool result uses a caller-safe error envelope. |

Protected tool failures should keep token values, session IDs, raw claims, and upstream identity details out of visible result text.

## Registration Steps

1. Add the tool adapter in `mcp/tools/`.
2. Add shared capability code outside `mcp/` when another surface needs the behavior.
3. Export the tool as a `McpTool`.
4. Add the tool to the `tools` array in `mcp/tool-registry.ts`.
5. Update [MCP API Reference](../api/mcp.md).
6. Update [GPT Apps Setup](../user-guides/gpt-apps.md) when ChatGPT users need to see the tool.
7. Add or update live MCP tests under `test/mcp/`.

## Test Requirements

Tool tests should prove:

- `tools/list` exposes the descriptor.
- The input schema accepts valid arguments.
- The input schema rejects unsupported arguments.
- Protected tools enforce required scopes.
- Wrong-audience tokens fail before tool execution.
- Successful calls return schema-valid `structuredContent`.
- Caller-safe failures use tool error envelopes.

Use `test/support/mcp.ts` for initialization, bearer tokens, session IDs, and tool calls.

UI render tools also need resource tests that cover `resources/list`, `resources/read`, UI metadata, MIME type, and scope behavior.

## Completion Checklist

Before committing an MCP tool change:

1. Confirm the descriptor fields are stable, specific, and schema-backed.
2. Confirm annotations match the actual behavior.
3. Confirm protected tools use the shared scope constants.
4. Confirm shared capability behavior stays outside `mcp/` when Actions also exposes it.
5. Confirm `tools/list`, `tools/call`, auth challenge, and schema validation tests pass.
6. Confirm MCP API docs and GPT Apps setup docs describe the tool accurately.

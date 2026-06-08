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
| `run` | Tool implementation. |

The registry validates descriptor shape, name uniqueness, scope syntax, schemas, annotations, icons, and invocation status text at runtime.

## Input And Output

Tool input schemas use helpers from `mcp/tool-schemas.ts`. Current tools use an empty object input schema.

Tool output returns a tool result envelope with:

- `content` for model-visible text.
- `structuredContent` for schema-validated data.
- `isError` for caller-safe tool failures.

The registry validates successful `structuredContent` against the advertised `outputSchema`. A schema mismatch is a service error and should fail tests.

## Authentication And Scopes

Every transport request uses an MCP-audience bearer token. Protected tools also call `verifyBearer` with the tool scopes. Scope failures return a `WWW-Authenticate` challenge and `_meta["mcp/www_authenticate"]` in the tool result.

Use scope arrays from `auth/scopes.ts` when a scope set is shared with Actions or OAuth docs.

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

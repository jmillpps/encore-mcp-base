# Adding Capabilities

New capabilities should use one implementation with protocol-specific adapters.

## Workflow

1. Define the capability behavior and output shape.
2. Add shared code when both Apps and Actions need the behavior.
3. Add an MCP tool adapter under `mcp/tools/`.
4. Register the MCP tool in `mcp/tool-registry.ts`.
5. Add an Actions endpoint under `actions/` when GPT Actions needs the behavior.
6. Add the OpenAPI operation in `tools/openapi-document.ts`.
7. Add live tests for each exposed surface.
8. Run targeted tests for the changed surface.
9. Run `npm run check` before final release.

## MCP Adapter Requirements

Each MCP tool defines:

- `name`
- `title`
- `description`
- `inputSchema`
- `outputSchema`
- `annotations`
- `invocation`
- `requiredScopes`
- `run`

Tool output must pass the advertised output schema. Protected tools must verify an MCP-audience token and required scopes before returning protected data.

## Actions Adapter Requirements

Each Actions endpoint defines:

- Method and path.
- Header and query input.
- Token audience validation.
- Required scopes.
- Response type.
- OpenAPI operation metadata.

Actions endpoints reject `access_token` query parameters and validate bearer tokens against the Actions audience.

## Tests

Tests belong under `test/`. Service tests should exercise live HTTP behavior where protocol behavior matters. Documentation wording and style are reviewed manually through rereading.

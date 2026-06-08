# Shared Types And Schemas

Use this guide when changing data shapes shared across OAuth, MCP, Actions, and tests.

## Ownership

Shared runtime types belong near the behavior they describe.

| Area | Source |
| --- | --- |
| Service configuration | `shared/config.ts` |
| Service errors | `shared/errors.ts` |
| Diagnostics | `shared/diagnostics.ts` |
| User profile | `auth/user-profile.ts` |
| Access token claims | `auth/tokens/token-claims.ts` |
| MCP tools | `mcp/tool-types.ts` |
| MCP schemas | `mcp/tool-schemas.ts` |
| Actions OpenAPI schemas | `actions/openapi-document.ts` |

Place a type in `shared/` when multiple feature roots use it and the type has no dependency on a feature root.

## Schema Reuse

MCP structured output schemas live with MCP tool descriptors. Actions schemas live in the OpenAPI document builder. Shared capability code should return plain data that both schema systems can validate.

When changing a shared shape:

1. Update the domain type.
2. Update each protocol schema that exposes the shape.
3. Update API documentation for the response.
4. Update live tests for every exposed surface.
5. Run the targeted tests for each affected surface.

## Validation

Treat request bodies, query parameters, headers, OAuth metadata, JSON-RPC params, tool arguments, and upstream userinfo as untrusted. Validate at the boundary before using values in capability logic.

Validation should cover:

- Required fields.
- Field type.
- Maximum size.
- URL scheme and host rules.
- Allowed enum values.
- Duplicate parameters.
- Unsupported fields.
- Line breaks in profile strings and secrets.

## Naming

Use names that describe the domain object and the surface. Keep protocol wrapper names tied to the protocol. Keep shared capability names free of transport details.

Examples:

| Good location | Name style |
| --- | --- |
| `auth/user-profile.ts` | `UserProfile` |
| `actions/endpoints.session.ts` | `SessionResponse` |
| `mcp/tool-types.ts` | `McpTool` |

## Change Review

Before merging a schema change, confirm:

- OAuth tokens still carry the expected claims.
- `/oauth/userinfo` still returns the documented profile.
- MCP tool outputs pass descriptor schemas.
- Actions responses match OpenAPI schemas.
- Tests cover successful and rejected input paths.

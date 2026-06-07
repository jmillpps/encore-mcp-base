# Capabilities

Capabilities are the service behaviors that GPT clients can invoke. A capability can be exposed through MCP for GPT Apps, through REST for GPT Actions, or through both surfaces.

## Current Capabilities

| Capability | MCP tool | Actions endpoint |
| --- | --- | --- |
| Service health | `health.check` | `GET /health` |
| Identity profile | `identity.profile` | `GET /actions/profile` |
| OAuth session | `auth.session` | `GET /actions/session` |

## Implementation Pattern

Shared behavior belongs in a focused module. Protocol adapters handle request shape, authentication, authorization, schemas, and protocol-specific response envelopes.

MCP adapters define:

- Tool name.
- Title and description.
- Input and output schemas.
- Annotations.
- Invocation status text.
- Required OAuth scopes.
- Tool result envelope.

Actions adapters define:

- HTTP method and path.
- Request headers and query parameters.
- OAuth scope enforcement.
- Response type.
- OpenAPI operation metadata.

## Why This Split Exists

GPT Apps and GPT Actions expose different protocols. MCP needs JSON-RPC tool descriptors, tool result envelopes, and auth challenges. Actions needs REST endpoints and OpenAPI operations. The capability behavior should remain consistent across both.

Use [Adding Capabilities](../development/adding-capabilities.md) for the development workflow.

# Project Structure

The repository keeps code, documentation, tools, and tests in separate roots.

| Path | Purpose |
| --- | --- |
| `actions/` | GPT Actions REST endpoint adapters. |
| `auth/` | OAuth provider, OIDC, token issuance, clients, scopes, and durable auth state. |
| `mcp/` | MCP protocol, transports, tools, sessions, descriptors, and result validation. |
| `shared/` | Shared runtime primitives with no imports from feature roots. |
| `tools/` | Local operator commands and repository checks. |
| `test/` | Live service tests and module tests. |
| `docs/` | Project documentation. |

## Dependency Boundaries

`shared/` is the lowest-level runtime root. `auth/` may use `shared/`. `actions/` and `mcp/` may use `auth/` and `shared/`. Runtime code imports from runtime roots only.

## File Scope

Files stay focused on one behavior. Protocol adapters stay thin. Shared capability behavior belongs in focused modules that can be reused by MCP and Actions surfaces.

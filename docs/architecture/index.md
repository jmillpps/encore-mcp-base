# Architecture

This section explains stable system design, protocol boundaries, trust boundaries, and decisions that shape the codebase.

## Architecture Reading Order

| Step | Read | Purpose |
| --- | --- | --- |
| 1 | [Overview](overview.md) | Build a mental model of service roots, request surfaces, security boundaries, and durable state. |
| 2 | [Security Model](security-model.md) | Understand validation, authentication, authorization, diagnostics, production controls, and attacker-controlled input. |
| 3 | [OAuth Provider](oauth-provider.md) | Understand authorization flow, token issuance, resource binding, upstream OIDC, refresh rotation, and discovery. |
| 4 | [MCP Transports](mcp-transports.md) | Understand Streamable HTTP, legacy HTTP/SSE, sessions, connection limits, and protocol-version handling. |
| 5 | [Actions And OpenAPI](actions-openapi.md) | Understand REST endpoint shape, OpenAPI generation, public schema serving, and Actions audience rules. |
| 6 | [Capabilities](capabilities.md) | Understand shared behavior ownership and protocol adapter responsibilities. |
| 7 | [Storage Model](storage-model.md) | Understand the durable JSON store, locking, atomic writes, hashed values, and recovery expectations. |

## Design Boundaries

| Boundary | Rule | Primary docs |
| --- | --- | --- |
| Protocol adapters | MCP and Actions adapters translate transport details and call shared behavior. | [Capabilities](capabilities.md), [Request Lifecycle](../development/request-lifecycle.md) |
| OAuth authority | The service issues downstream OAuth tokens and delegates user authentication to upstream OIDC. | [OAuth Provider](oauth-provider.md), [Identity Provider](../deployment/identity-provider.md) |
| Audience separation | MCP tokens use the MCP resource audience and Actions tokens use the Actions audience. | [Security Model](security-model.md), [Configuration Reference](../api/configuration.md) |
| Durable state | OAuth grants, refresh tokens, rate limits, and MCP sessions share one guarded store. | [Storage Model](storage-model.md), [Storage Maintenance](../maintenance/storage.md) |
| External specs | Architecture claims must align with authoritative external specs and official product docs. | [External References](../reference/external-references.md) |

## Decision Anchors

| Decision | Start with | Confirm with |
| --- | --- | --- |
| Endpoint ownership | [Overview](overview.md) | [Request Lifecycle](../development/request-lifecycle.md) |
| Token audience | [Security Model](security-model.md) | [Configuration Reference](../api/configuration.md) |
| OAuth flow | [OAuth Provider](oauth-provider.md) | [OAuth API Reference](../api/oauth.md) |
| MCP transport path | [MCP Transports](mcp-transports.md) | [MCP API Reference](../api/mcp.md) |
| Actions schema rule | [Actions And OpenAPI](actions-openapi.md) | [OpenAPI Contract](../api/openapi.md) |
| State record ownership | [Storage Model](storage-model.md) | [Storage Maintenance](../maintenance/storage.md) |

Use [Request Lifecycle](../development/request-lifecycle.md) for a developer trace through the runtime paths.

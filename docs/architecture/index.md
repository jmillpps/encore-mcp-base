# Architecture

This section explains stable system design, protocol boundaries, and security decisions.

- [Overview](overview.md) explains the service layout and trust boundaries.
- [OAuth Provider](oauth-provider.md) explains authorization, tokens, resources, and OIDC.
- [MCP Transports](mcp-transports.md) explains Streamable HTTP and legacy HTTP/SSE.
- [Actions And OpenAPI](actions-openapi.md) explains the REST and schema surface.
- [Capabilities](capabilities.md) explains shared behavior and protocol adapters.
- [Security Model](security-model.md) explains validation, auth, diagnostics, and production security controls.
- [Storage Model](storage-model.md) explains durable state ownership.

Use [Request Lifecycle](../development/request-lifecycle.md) for a developer trace through the runtime paths.

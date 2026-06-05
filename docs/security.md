# Security

All query parameters, headers, request bodies, token claims, resource identifiers, redirect URIs, and tool arguments are attacker-controlled input.

The service validates inputs before use, stores only token hashes for durable OAuth state, uses constant-time comparison for secret checks, and binds access tokens to the intended audience.

Authentication failures return generic client errors and redacted diagnostics.

Origin validation protects MCP HTTP transports from browser-origin attacks.

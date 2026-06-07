# Security

All query parameters, headers, request bodies, token claims, resource identifiers, redirect URIs, and tool arguments are attacker-controlled input.

The service validates inputs before use, stores only token hashes for durable OAuth state, uses constant-time comparison for secret checks, and binds access tokens to the intended audience.

JWT validation limits compact tokens to 8192 characters, requires `alg` to be `RS256`, accepts safe key IDs, requires `typ` to be absent or `JWT`, and rejects unsupported critical headers.

Authentication failures return generic client errors and redacted diagnostics.

Origin validation protects MCP HTTP transports from browser-origin attacks.

Raw MCP handlers return HTTP 403 for invalid present `Origin` headers.

Encore gateway CORS configuration pins preflight origins and MCP transport headers in `encore.app`.

MCP CORS responses expose `MCP-Session-Id` and `WWW-Authenticate` for browser-hosted ChatGPT clients.

Production deployment validation must verify browser preflight requests with invalid present `Origin` headers return HTTP 403 at the public `/mcp` ingress.

Client ID Metadata Document retrieval treats the client ID URL as attacker-controlled input.

Production metadata retrieval requires HTTPS, rejects loopback and private network targets, pins DNS resolution for the outbound request, disables redirects, limits response size, and uses a short request timeout.

Metadata documents must use exact `client_id` matching and exact redirect URI registration.

Metadata-document clients are public clients and require PKCE.

The token endpoint rejects secrets submitted for metadata-document clients.

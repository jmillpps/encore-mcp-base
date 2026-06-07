# Security Model

Security is part of every service boundary. Public HTTP input, OAuth metadata, token claims, resource identifiers, redirect URIs, request bodies, headers, and tool arguments are untrusted.

## Controls

| Area | Control |
| --- | --- |
| Token validation | RS256 JWTs, safe key IDs, bounded token size, strict NumericDate handling. |
| Audience binding | MCP endpoints accept MCP resource tokens. Actions endpoints accept Actions audience tokens. |
| Scope enforcement | Tools and Actions endpoints enforce required scopes. |
| Secrets | Client secrets are hashed. Raw bearer tokens stay out of storage. |
| Diagnostics | Client errors are generic. Diagnostic output redacts secrets. |
| Rate limits | Durable buckets apply to OAuth endpoints and MCP tools. |
| Browser origins | MCP transport origins are validated and CORS headers are pinned. |
| Query tokens | Public endpoints reject `access_token` URI query parameters. |

## OAuth Security

Authorization code grants require exact redirect matching and PKCE according to client policy. Refresh tokens rotate on use. Replay of an older refresh token revokes the token family.

Resource indicators bind access tokens to the intended audience. Resource errors use generic descriptions.

## MCP Security

Every MCP transport request requires an MCP-audience bearer token. Initialize requests validate auth before JSON parsing and session creation. Protected tools return ChatGPT-compatible auth challenges when scopes are missing.

## Production Security

Production configuration requires public HTTPS URLs, explicit clients, explicit token lifetimes, explicit rate limits, explicit store path, and signing key material. Startup fails when required security configuration is missing.

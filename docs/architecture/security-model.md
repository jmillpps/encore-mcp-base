# Security Model

Security is part of every service boundary. Public HTTP input, OAuth metadata, token claims, resource identifiers, redirect URIs, request bodies, headers, and tool arguments are untrusted.

## Trust Boundaries

| Boundary | Untrusted input | First validation owner |
| --- | --- | --- |
| OAuth authorization | Query parameters, client ID, redirect URI, scopes, resource, PKCE challenge, nonce, ID token hint, locale hints. | `auth/authorize.ts` and client resolution modules. |
| OAuth token | Form fields, Basic auth header, client assertion, authorization code, code verifier, refresh token, resource. | `auth/token.ts` and token grant modules. |
| Upstream OIDC | Callback query, upstream token response, upstream userinfo response. | `auth/endpoints.upstream-callback.ts` and `auth/upstream-oidc-client.ts`. |
| MCP transport | Origin, Authorization header, query parameters, Accept header, Content-Type header, session headers, JSON body. | `mcp/endpoints.*.ts` and `mcp/transport-headers.ts`. |
| MCP tool call | Tool name, arguments, `_meta`, task metadata, bearer token, tool output. | `mcp/protocol.ts` and `mcp/tool-registry.ts`. |
| MCP resource read | Resource URI, cursor, `_meta`, bearer token, resource metadata, HTML content. | `mcp/protocol.ts` and `mcp/resource-registry.ts`. |
| Actions REST | Authorization header, query parameters, response contracts, OpenAPI metadata. | `actions/action-bearer.ts` and Actions endpoint modules. |
| Client metadata | Client ID URL, fetched metadata document, redirect URIs, JWKS URI, private key JWT assertions. | `auth/client-metadata-*` and `auth/client-assertion.ts`. |
| Storage | Store path, existing file type, file mode, file contents, lock state. | `auth/storage/*`. |

## Controls

| Area | Control |
| --- | --- |
| Token validation | RS256 JWTs, safe key IDs, bounded token size, strict NumericDate handling. |
| Audience binding | MCP endpoints accept MCP resource tokens. Actions endpoints accept Actions audience tokens. |
| Scope enforcement | Tools, resources, and Actions endpoints enforce required scopes. |
| Secrets | Client secrets are hashed. Raw bearer tokens stay out of storage. |
| Diagnostics | Client errors are generic. Diagnostic output redacts secrets. |
| Rate limits | Durable buckets apply to OAuth endpoints, MCP tools, and MCP resource reads. |
| Browser origins | MCP transport origins are validated and CORS headers are pinned. |
| Query tokens | Public endpoints reject `access_token` URI query parameters. |
| OpenAPI schema | `/actions/openapi.json` is public, read-only, and generated from the configured issuer. |
| Store safety | Store reads reject symlinks, shared file permissions, malformed JSON, and upward path traversal. |
| Metadata clients | Metadata documents and JWKS locations are treated as untrusted network input. |

## OAuth Security

Authorization code grants require exact redirect matching and PKCE according to client policy. Refresh tokens rotate on use. Replay of an older refresh token revokes the token family.

Resource indicators bind access tokens to the intended audience. Resource errors use generic descriptions.

| OAuth control | Runtime behavior |
| --- | --- |
| Redirect URI | Exact match against the resolved client record. |
| Scope policy | Requested scopes must be allowed by the current client record. |
| Resource policy | Access token audience comes from the resolved resource and must be allowed by the client. |
| Client authentication | Supports `client_secret_post`, `client_secret_basic`, `private_key_jwt`, and local public clients from metadata documents. |
| PKCE | Enforced by client policy. Production client records require PKCE unless a confidential GPT Actions client class is explicitly configured. |
| Upstream OIDC | Uses service-owned PKCE state and validates upstream userinfo before issuing service tokens. |
| Token storage | Authorization codes, upstream states, refresh tokens, and MCP session IDs are stored as hashes. |

## Audience And Scope Failures

MCP endpoints accept tokens whose audience equals the MCP resource. Actions endpoints accept tokens whose audience equals the Actions audience.

Wrong-audience tokens fail authorization for the requested surface. Missing scopes return a scope challenge for MCP tools and a forbidden response for Actions endpoints. Invalid bearer tokens receive client-safe authentication errors.

## MCP Security

Every MCP transport request requires an MCP-audience bearer token. Initialize requests validate auth before JSON parsing and session creation. Protected tools and protected resources return ChatGPT-compatible auth challenges when scopes are missing.

Transport endpoints reject query bearer tokens, duplicate authorization headers, disallowed origins, unsupported media types, malformed JSON-RPC envelopes, duplicate request IDs, uninitialized session method calls, and expired or terminated sessions.

MCP tools validate descriptors at registry creation and validate tool output before returning the result envelope. Tool output resource links are constrained to safe URI schemes.

MCP resources validate descriptor shape, resource URI schemes, MIME types, content shape, metadata objects, CSP origins, and widget domains before exposure. UI resource metadata avoids secrets and pins network access through explicit CSP fields.

## Production Security

Production configuration requires public HTTPS URLs, explicit clients, explicit token lifetimes, explicit rate limits, explicit store path, and signing key material. Startup fails when required security configuration is missing.

Production URL validation rejects private hosts, unsupported URL parts, wildcard origins, and insecure protocols. OAuth clients must provide explicit redirect URIs, allowed resources, allowed scopes, authentication method, PKCE policy, and client class.

## AWS Deployment Security

The CDK deployment applies these controls:

| Area | Control |
| --- | --- |
| Instance metadata | EC2 requires IMDSv2. |
| Network ingress | Security group allows inbound `80` and `443`. |
| Runtime secrets | SecureString parameters use the stack KMS key. |
| IAM scope | EC2 role reads only the configured Parameter Store path. |
| Key handling | The private signing key is written to an instance-local `0400` file. |
| Storage | Root EBS volume is encrypted. |
| HTTPS proxy | Caddy terminates HTTPS and sets response security headers. |
| Binary install | Caddy archive checksum is verified before installation. |
| Source packaging | Source archive requires a clean worktree and uses tracked files from `HEAD`. |

## Review Focus

Security review for each change should cover:

| Review area | Evidence to inspect |
| --- | --- |
| Authentication | Correct audience, token issuer, token lifetime, accepted client auth method, and key ID handling. |
| Authorization | Required scopes, client resource policy, exact redirect URI policy, and surface-specific audience checks. |
| Input validation | Header parsing, media types, JSON-RPC shapes, OAuth fields, OpenAPI fields, and userinfo claims. |
| Secret handling | Raw secrets stay in environment, Parameter Store, runtime secret files, or memory. Stored values use hashes. |
| Diagnostics | Client-facing errors stay generic and operational logs redact secret-bearing fields. |
| State mutation | Store lock behavior, atomic writes, replay prevention, refresh rotation, and rollback behavior. |

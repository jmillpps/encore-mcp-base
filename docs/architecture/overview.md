# Architecture Overview

GPT MCP Service is one Encore TypeScript service with separate protocol adapters. The service supports GPT Apps through MCP, GPT Actions through REST plus OpenAPI, and account linking through a private OAuth/OIDC provider.

The architecture is organized around one rule: shared capability behavior lives once, then each external protocol receives a focused adapter.

## Runtime Layout

Runtime code is grouped by service boundary:

| Directory | Runtime role | Primary ownership |
| --- | --- | --- |
| `auth/` | OAuth provider, upstream OIDC bridge, client registry, token issuance, durable OAuth state, discovery, userinfo, JWKS, and rate limits. | Account linking, token policy, identity proof, client trust, and storage-backed OAuth records. |
| `mcp/` | MCP Streamable HTTP, legacy HTTP/SSE, JSON-RPC parsing, session lifecycle, tool registry, UI resource registry, schema validation, result validation, and auth challenges. | GPT Apps transport, tool, and resource protocol behavior. |
| `actions/` | GPT Actions REST endpoints, Actions bearer validation, public privacy endpoint, public OpenAPI endpoint, and OpenAPI document assembly. | GPT Actions HTTP behavior and schema import behavior. |
| `shared/` | Runtime configuration, HTTP response helpers, JSON record helpers, diagnostics redaction, cryptographic helpers, media-type parsing, network-address validation, and service metadata. | Cross-surface primitives used by protocol adapters. |
| `tools/` | OpenAPI export, source archive creation, compatibility checks, dependency checks, architecture checks, file-scope checks, and test-placement checks. | Operator and maintainer verification. |
| `test/` | Live service tests, protocol tests, security tests, CDK tests, and reusable test harnesses. | Functional verification against real runtime behavior. |

The only runtime dependency is `encore.dev`. Test and development tooling uses TypeScript, Node types, and `oauth4webapi`.

## Dependency Direction

Runtime modules follow a narrow dependency direction:

| From | May depend on | Purpose |
| --- | --- | --- |
| `auth/` | `shared/` | OAuth and identity logic use shared HTTP, crypto, diagnostics, config, and time helpers. |
| `mcp/` | `auth/`, `shared/` | MCP endpoints verify bearer tokens, use durable session state, and share config and HTTP helpers. |
| `actions/` | `auth/`, `shared/` | Actions endpoints verify access tokens and reuse shared response types. |
| `shared/` | Node standard library only | Shared primitives remain independent from protocol owners. |
| `tools/` | Runtime modules and Node standard library | Local checks can inspect generated metadata and source structure. |

This shape keeps infrastructure code small and lets OAuth, MCP, and Actions evolve through owned files.

## Request Surfaces

| Surface | Entrypoints | Transport ownership | Primary clients |
| --- | --- | --- | --- |
| GPT Apps MCP | `OPTIONS /mcp`, `POST /mcp`, `GET /mcp`, `DELETE /mcp` | Raw Encore endpoints with MCP Streamable HTTP behavior. | ChatGPT Apps and MCP clients using protocol `2025-11-25`. |
| Legacy GPT Apps MCP | `GET /sse`, `POST /messages` | Raw Encore endpoints with process-bound SSE sessions. | Clients using the older HTTP/SSE MCP transport. |
| GPT Actions | `GET /health`, `GET /privacy`, `GET /actions/openapi.json`, `GET /actions/profile`, `GET /actions/session` | Encore typed APIs and raw public document endpoints. | ChatGPT Actions importing OpenAPI 3.1 and calling REST operations. |
| OAuth provider | `/oauth/authorize`, `/oauth/callback`, `/oauth/token`, `/oauth/userinfo`, `/oauth/jwks`, well-known discovery paths | Raw Encore endpoints for browser redirects, form posts, bearer validation, and metadata documents. | ChatGPT account linking, token refresh, and clients validating discovery metadata. |

The raw endpoint choice gives the service direct control over headers, status codes, SSE lifetime, redirects, OAuth error bodies, and JSON-RPC envelopes.

## Shared Security Model

All public surfaces validate attacker-controlled input before behavior reaches business logic. Inputs include headers, query parameters, request bodies, JSON-RPC messages, OAuth metadata documents, token claims, redirect URIs, resource indicators, tool arguments, and OpenAPI export arguments.

OAuth access tokens are audience-bound:

| Audience | Used by | Config source |
| --- | --- | --- |
| MCP resource | `/mcp`, `/sse`, `/messages`, MCP protected tools. | `MCP_RESOURCE_URL`, defaulting to the public issuer plus `/mcp` in development. |
| Actions audience | `/actions/profile`, `/actions/session`. | `ACTIONS_AUDIENCE`, defaulting to the public issuer plus `/actions` in development. |

The same OAuth provider issues tokens for both GPT Apps and GPT Actions. Each endpoint adapter validates the audience and scopes that match its protocol surface.

## Durable State

OAuth state, refresh tokens, rate-limit buckets, and MCP Streamable HTTP sessions are stored in one JSON file. Sensitive tokens, authorization codes, upstream states, and MCP session IDs are stored as SHA-256 base64url hashes.

The store enforces owner-only permissions, rejects symlinks, serializes writes inside the process, serializes writes across processes with a lock file, writes temporary files with `0600`, and commits updates with atomic rename. Storage design is covered in [Storage Model](storage-model.md). Operator handling is covered in [Storage Maintenance](../maintenance/storage.md).

## Configuration Boundary

Runtime configuration is read from environment variables and generated runtime files. Production startup requires public HTTPS URLs, explicit origins, explicit OAuth clients, upstream OIDC configuration, signing key material, positive token lifetimes, positive rate limits, and a durable store path.

The AWS CDK path stores runtime parameters in Systems Manager Parameter Store. Secure values use SecureString parameters backed by KMS. Operator-specific account values, hosted zones, domains, parameter prefixes, stack names, client secrets, and resource IDs stay outside tracked source.

## Design Rule

New service capabilities should keep core behavior in a shared module. MCP tools, MCP UI resources, and Actions endpoints should act as protocol adapters around that behavior. This keeps the capability implementation consistent across GPT Apps and GPT Actions.

Use [Capabilities](capabilities.md), [MCP Tool Development](../development/mcp-tool-development.md), [MCP Apps UI Resources](../development/mcp-app-ui-resources.md), and [Actions Endpoint Development](../development/actions-endpoint-development.md) before adding a new capability surface.

# Architecture Overview

GPT MCP Service is one Encore TypeScript service with separate protocol adapters. The service supports GPT Apps through MCP and GPT Actions through REST plus OpenAPI.

## Runtime Layout

Runtime code is grouped by service boundary:

| Directory | Owner |
| --- | --- |
| `auth/` | OAuth, OIDC, clients, tokens, storage, rate limits, and discovery. |
| `mcp/` | MCP protocol, transports, tool registry, tool validation, and SSE sessions. |
| `actions/` | GPT Actions REST endpoints and bearer validation. |
| `shared/` | Configuration, HTTP helpers, JSON helpers, diagnostics, crypto helpers, and service metadata. |
| `tools/` | Local operator tools and static verification helpers. |
| `test/` | Live service tests, protocol tests, security tests, and tool tests. |

The only runtime dependency is `encore.dev`. Test and development tooling uses TypeScript, Node types, and `oauth4webapi`.

## Request Surfaces

| Surface | Transport | Primary reader |
| --- | --- | --- |
| GPT Apps | MCP Streamable HTTP at `/mcp` | ChatGPT Apps clients. |
| Legacy GPT Apps | HTTP/SSE at `/sse` and `/messages` | Clients that still use the legacy transport. |
| GPT Actions | REST at `/actions/*` and `/health` | ChatGPT Actions. |
| OAuth | HTTP endpoints under `/oauth/*` and well-known paths | GPT account linking and client token validation. |

## Shared Security Model

All public surfaces validate inputs before behavior reaches business logic. OAuth access tokens are audience-bound. MCP tokens use the MCP resource audience. Actions tokens use the Actions audience.

The same OAuth provider issues tokens for both GPT Apps and GPT Actions. Each endpoint adapter validates the audience and scopes that match its protocol surface.

## Durable State

OAuth state, refresh tokens, rate-limit buckets, and MCP Streamable HTTP sessions are stored in one JSON file. Sensitive tokens and session IDs are stored as hashes. Storage design is covered in [Storage Model](storage-model.md). Operator handling is covered in [Storage Maintenance](../maintenance/storage.md).

## Design Rule

New service capabilities should keep core behavior in a shared module. MCP tools and Actions endpoints should act as protocol adapters around that behavior. This keeps the capability implementation consistent across GPT Apps and GPT Actions.

# API Documentation

This section documents public service contracts. It focuses on protocol behavior, request shape, response shape, authentication, authorization, status codes, configuration, and generated schema behavior.

## API Reading Order

| Step | Read | Purpose |
| --- | --- | --- |
| 1 | [OAuth API Reference](oauth.md) | Understand account linking, token grants, discovery, userinfo, JWKS, and OAuth error shapes. |
| 2 | [MCP API Reference](mcp.md) | Understand GPT Apps transports, JSON-RPC behavior, sessions, auth challenges, and tools. |
| 3 | [Actions API Reference](actions.md) | Understand REST endpoints used by GPT Actions and their bearer-token requirements. |
| 4 | [OpenAPI Contract](openapi.md) | Understand the served Actions schema, URL import, export command, and compatibility checks. |
| 5 | [Identity Profile](identity-profile.md) | Understand profile claim requirements and defaults. |
| 6 | [Configuration Reference](configuration.md) | Understand runtime environment variables, URL rules, lifetimes, origins, and upstream OIDC settings. |

## Contract Ownership

| Contract area | Owning docs | Owning code |
| --- | --- | --- |
| OAuth authorization, token, userinfo, JWKS, and discovery | [OAuth API Reference](oauth.md) | `auth/` |
| MCP Streamable HTTP, legacy SSE, JSON-RPC, sessions, tools, and resources | [MCP API Reference](mcp.md) | `mcp/` |
| GPT Actions REST and public read-only OpenAPI endpoint | [Actions API Reference](actions.md), [OpenAPI Contract](openapi.md) | `actions/` |
| Identity claim normalization | [Identity Profile](identity-profile.md) | `auth/user-profile.ts` |
| Runtime configuration and production startup validation | [Configuration Reference](configuration.md) | `shared/config.ts`, `auth/startup.ts` |

## Endpoint Families

| Family | Public paths | Auth model | Response model |
| --- | --- | --- | --- |
| OAuth and OIDC | `/oauth/*`, `/.well-known/*` | Client authentication, browser redirect state, or bearer token depending on endpoint. | OAuth JSON error bodies, redirects, JWKS, userinfo, and discovery JSON. |
| MCP Streamable HTTP | `/mcp` | MCP-audience bearer token for POST, GET, and DELETE; CORS preflight validates header shape. | JSON-RPC response bodies, accepted responses, empty responses, and SSE streams. |
| Legacy MCP HTTP/SSE | `/sse`, `/messages` | MCP-audience bearer token. | SSE receive stream and accepted message posts. |
| GPT Actions REST | `/health`, `/privacy`, `/actions/*` | Public endpoints or Actions-audience bearer token. | JSON response bodies, plain text privacy text, and Encore error bodies. |

## API Review Rules

| Change type | Required API review |
| --- | --- |
| New OAuth field, endpoint, grant, or client auth method | Update OAuth API docs, client registry docs, discovery expectations, and OAuth tests. |
| New MCP tool, resource, or transport behavior | Update MCP API docs, capability docs, GPT Apps guide, and MCP live tests. |
| New Actions endpoint | Update Actions API docs, OpenAPI contract docs, Actions guide, and OpenAPI compatibility tests. |
| New identity claim | Update identity profile docs, token claim behavior, OpenAPI schemas, MCP output schemas, and upstream IdP tests. |
| New configuration variable | Update configuration docs, runtime parameter docs, CDK docs, production startup tests, and deployment guides. |

## External Specifications

Use [External References](../reference/external-references.md) when an API page mentions MCP, ChatGPT Apps, GPT Actions, OAuth, OIDC, OpenAPI, JSON Schema, Encore, or AWS runtime services. Keep protocol claims aligned with the linked source and the current implementation.

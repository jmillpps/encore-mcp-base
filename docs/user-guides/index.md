# User Guides

These guides help GPT builders, local developers, and operators reach a working outcome with exact setup values and verification steps.

## Guide Selection

| Goal | Guide | Output |
| --- | --- | --- |
| Start the service locally | [Local Development](local-development.md) | Running Encore service, health response, discovery metadata, local OpenAPI export. |
| Prove local runtime behavior | [Local End-To-End Scenarios](local-end-to-end.md) | Evidence for health, discovery, OAuth, MCP, Actions, and reset paths. |
| Connect GPT Apps | [GPT Apps Setup](gpt-apps.md) | ChatGPT app configured with MCP URL, OAuth URLs, scopes, and account linking. |
| Connect GPT Actions | [GPT Actions Setup](gpt-actions.md) | GPT Action imported from OpenAPI and linked through OAuth. |

## Shared Setup Values

| Surface | Local URL | Production URL shape |
| --- | --- | --- |
| MCP Streamable HTTP | `http://localhost:4000/mcp` | `https://service.example.com/mcp` |
| Actions OpenAPI | `http://localhost:4000/actions/openapi.json` | `https://service.example.com/actions/openapi.json` |
| OAuth authorize | `http://localhost:4000/oauth/authorize` | `https://service.example.com/oauth/authorize` |
| OAuth token | `http://localhost:4000/oauth/token` | `https://service.example.com/oauth/token` |
| Privacy policy | `http://localhost:4000/privacy` | `https://service.example.com/privacy` |

## Before Using ChatGPT

- Verify `GET /health`.
- Verify OAuth discovery metadata.
- Verify MCP protected resource metadata.
- Verify the Actions OpenAPI document.
- Confirm the OAuth client record contains the ChatGPT callback URL.
- Confirm requested scopes match the tool or endpoint requirements.

## Setup Decision Guide

| Need | Required guide path |
| --- | --- |
| Learn local values and commands | [Local Development](local-development.md), then [Local End-To-End Scenarios](local-end-to-end.md). |
| Configure a GPT App from a remote MCP server | [GPT Apps Setup](gpt-apps.md), then [MCP API Reference](../api/mcp.md). |
| Configure GPT Actions from URL import | [GPT Actions Setup](gpt-actions.md), then [OpenAPI Contract](../api/openapi.md). |
| Prepare production values for ChatGPT | [Production Deployment](../deployment/production.md), [Client Registry](../deployment/client-registry.md), and [Identity Provider](../deployment/identity-provider.md). |
| Troubleshoot account linking | [OAuth API Reference](../api/oauth.md), [Diagnostics And Rate Limits](../maintenance/diagnostics-rate-limits.md), and the relevant ChatGPT setup guide. |

## Evidence To Keep

| Flow | Evidence |
| --- | --- |
| Local service | Health response, OpenID configuration, protected resource metadata, and OpenAPI response. |
| GPT Apps | MCP URL, OAuth URLs, scopes, callback URL, successful account link, and tool list. |
| GPT Actions | OpenAPI import URL, OAuth URLs, scopes, callback URL, successful account link, and session call. |
| Production handoff | Public URL set, registered clients, upstream IdP callback, Parameter Store path, and release verification result. |

Use [External References](../reference/external-references.md) when ChatGPT UI behavior or OAuth requirements need current official source confirmation.

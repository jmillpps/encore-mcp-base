# Documentation

GPT MCP Service is a private ChatGPT integration service. It provides OAuth, MCP for GPT Apps, OpenAPI-backed REST endpoints for GPT Actions, upstream OIDC identity proof, secure token storage, production validation, AWS deployment guidance, and focused developer tooling.

This documentation is organized by reader task. Start with the path that matches the work, then follow the links inside each page for protocol details, operational rules, and verification steps.

## Reading Paths

| Reader | Start here | Continue with |
| --- | --- | --- |
| First-time local developer | [Local Development](user-guides/local-development.md) | [Local End-To-End Scenarios](user-guides/local-end-to-end.md), [Testing](development/testing.md) |
| GPT Apps builder | [GPT Apps Setup](user-guides/gpt-apps.md) | [MCP API Reference](api/mcp.md), [MCP Transports](architecture/mcp-transports.md) |
| GPT Actions builder | [GPT Actions Setup](user-guides/gpt-actions.md) | [Actions API Reference](api/actions.md), [OpenAPI Contract](api/openapi.md) |
| Security reviewer | [Security Model](architecture/security-model.md) | [OAuth Provider](architecture/oauth-provider.md), [Security Review](development/security-review.md) |
| Production operator | [Production Deployment](deployment/production.md) | [AWS CDK Deployment](deployment/aws-cdk.md), [Release Verification](deployment/release-verification.md) |
| Maintainer | [Maintainer Critical Areas](development/maintainer-critical-areas.md) | [Project Structure](development/project-structure.md), [Change Readiness](development/change-readiness.md) |

## Documentation Families

| Family | Purpose | Use when |
| --- | --- | --- |
| [User Guides](user-guides/index.md) | Outcome-driven workflows for local development, GPT Apps, GPT Actions, and end-to-end proof. | You need to run, connect, import, or manually verify the service. |
| [API](api/index.md) | Public protocol contracts, endpoint shapes, authentication rules, schemas, and configuration values. | You need exact request, response, status, scope, audience, and environment behavior. |
| [Architecture](architecture/index.md) | Runtime layout, trust boundaries, transport design, OAuth provider design, storage, and capability sharing. | You need design context before changing code. |
| [Deployment](deployment/index.md) | Production environment setup, AWS CDK, Parameter Store, identity provider modes, build flow, and release verification. | You need to deploy, update, seed, restart, validate, or tear down the service. |
| [Development](development/index.md) | Code ownership, change workflow, tool and endpoint development, schema ownership, tests, and documentation rules. | You need to extend, refactor, review, test, or document the service. |
| [Maintenance](maintenance/index.md) | Operational procedures for signing keys, durable storage, client metadata, diagnostics, and rate limits. | You need to operate or recover a running service. |
| [Reference](reference/index.md) | Authoritative external specifications and official service documentation used by this repository. | You need to check the upstream source for a protocol or platform requirement. |

## Protocol And Platform Entry Points

| Topic | Project doc | External source map |
| --- | --- | --- |
| MCP transport and tools | [MCP API Reference](api/mcp.md), [MCP Transports](architecture/mcp-transports.md) | [External References](reference/external-references.md#mcp-and-chatgpt-apps) |
| OAuth and OIDC | [OAuth API Reference](api/oauth.md), [OAuth Provider](architecture/oauth-provider.md) | [External References](reference/external-references.md#oauth-and-oidc) |
| GPT Actions OpenAPI | [Actions API Reference](api/actions.md), [OpenAPI Contract](api/openapi.md) | [External References](reference/external-references.md#gpt-actions-and-openapi) |
| AWS deployment | [AWS CDK Deployment](deployment/aws-cdk.md), [Runtime Parameters](deployment/runtime-parameters.md) | [External References](reference/external-references.md#aws-and-deployment) |
| Encore runtime | [Project Structure](development/project-structure.md), [Actions Endpoint Development](development/actions-endpoint-development.md) | [External References](reference/external-references.md#encore-typescript-runtime) |

## Documentation Quality Rules

- Keep repository documentation under `docs/`, with `README.md` as the public project front page.
- Keep source code focused on implementation and keep durable explanations in documentation.
- Use generic examples for domains, AWS accounts, hosted zones, resource IDs, client IDs, and secrets.
- Tie service tests to live service behavior and protocol contracts.
- Review documentation prose by reading the file directly.
- Update the relevant API, architecture, deployment, development, maintenance, and reference pages when a behavior change crosses those boundaries.

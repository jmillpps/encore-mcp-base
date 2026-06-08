# Developer Critical Areas

This guide maps developer learning areas to the documents that explain the service.

## Area Map

| Area | Developer focus | Primary docs |
| --- | --- | --- |
| Developer orientation and learning path | Choose the right reading path for using, extending, or verifying the service. | [Local Development](../user-guides/local-development.md), [Request Lifecycle](request-lifecycle.md), [Capabilities](../architecture/capabilities.md) |
| Local development environment | Install tools, start Encore, verify metadata, export OpenAPI, and reset local state. | [Local Development](../user-guides/local-development.md), [Local End-To-End Scenarios](../user-guides/local-end-to-end.md) |
| Repository structure for developers | Locate feature roots, tests, tools, and documentation before editing. | [Project Structure](project-structure.md), [Adding Capabilities](adding-capabilities.md) |
| Runtime request lifecycle | Trace OAuth, MCP, Actions, shared capability, diagnostic, and storage paths. | [Request Lifecycle](request-lifecycle.md), [Architecture Overview](../architecture/overview.md) |
| OAuth account linking flow | Understand ChatGPT authorization, upstream sign-in, callback handling, token grants, and errors. | [OAuth Provider](../architecture/oauth-provider.md), [OAuth API](../api/oauth.md) |
| Developer client registration | Configure local clients, production records, secret hashes, redirect URIs, scopes, audiences, and metadata clients. | [Client Registry](../deployment/client-registry.md), [Client Metadata Maintenance](../maintenance/client-metadata.md) |
| External identity provider contract | Configure a generic upstream OIDC provider and map provider values into runtime configuration. | [Identity Provider](../deployment/identity-provider.md), [Identity Provider Testing](identity-provider-testing.md) |
| Scopes, audiences, and resource binding | Preserve surface-specific token audiences and scope enforcement while adding behavior. | [Security Model](../architecture/security-model.md), [Configuration Reference](../api/configuration.md) |
| GPT Apps integration | Configure ChatGPT Apps, account link, initialize MCP, list tools, and troubleshoot transport issues. | [GPT Apps Setup](../user-guides/gpt-apps.md), [MCP API Reference](../api/mcp.md) |
| GPT Actions integration | Import OpenAPI, configure OAuth, account link, call Actions endpoints, and troubleshoot schema issues. | [GPT Actions Setup](../user-guides/gpt-actions.md), [Actions API Reference](../api/actions.md) |
| Capability design pattern | Implement shared behavior once and expose it through protocol adapters. | [Adding Capabilities](adding-capabilities.md), [Capabilities](../architecture/capabilities.md) |
| MCP tool development | Add descriptors, schemas, scopes, registry entries, auth behavior, and live tool tests. | [MCP Tool Development](mcp-tool-development.md), [MCP API Reference](../api/mcp.md) |
| Actions endpoint development | Add Encore routes, bearer validation, response models, OpenAPI operations, and live HTTP tests. | [Actions Endpoint Development](actions-endpoint-development.md), [Actions And OpenAPI](../architecture/actions-openapi.md) |
| Shared types and schemas | Reuse request, response, identity, capability, tool, and OpenAPI models across adapters. | [Shared Types And Schemas](shared-types-schemas.md), [Project Structure](project-structure.md) |
| Errors, diagnostics, and troubleshooting | Use client-safe errors, auth challenges, diagnostics, redaction, rate limits, and failure order. | [Diagnostics And Rate Limits](../maintenance/diagnostics-rate-limits.md), [Security Review](security-review.md) |
| Test harness and targeted verification | Select the right live service tests, harness helpers, security tests, and full release gate. | [Testing](testing.md), [Identity Provider Testing](identity-provider-testing.md) |
| Local end-to-end scenarios | Prove local health, discovery, OAuth, MCP, Actions, and state reset behavior with evidence. | [Local End-To-End Scenarios](../user-guides/local-end-to-end.md) |
| Security requirements for developers | Review trust boundaries, validation, scopes, secrets, signing keys, diagnostics, and storage. | [Security Review](security-review.md), [Security Model](../architecture/security-model.md) |
| Deployment inputs developers need to know | Understand public origins, audiences, clients, upstream OIDC values, Parameter Store, and stack outputs. | [Runtime Parameters](../deployment/runtime-parameters.md), [Production Deployment](../deployment/production.md) |
| Contribution, commit, and release readiness | Keep feature slices small, run targeted checks, commit source before builds, and update docs. | [Change Readiness](change-readiness.md), [Testing](testing.md), [Source Build](../deployment/source-build.md) |

## Reading Paths

Use these paths by task:

| Task | Reading path |
| --- | --- |
| Run locally | [Local Development](../user-guides/local-development.md), then [Local End-To-End Scenarios](../user-guides/local-end-to-end.md). |
| Configure GPT Apps | [GPT Apps Setup](../user-guides/gpt-apps.md), then [MCP API Reference](../api/mcp.md). |
| Configure GPT Actions | [GPT Actions Setup](../user-guides/gpt-actions.md), then [Actions API Reference](../api/actions.md). |
| Add a capability | [Adding Capabilities](adding-capabilities.md), then the MCP and Actions development guides needed for the surface. |
| Review security | [Security Review](security-review.md), then [Security Model](../architecture/security-model.md). |
| Prepare release | [Change Readiness](change-readiness.md), [Testing](testing.md), [Release Verification](../deployment/release-verification.md), and [Source Build](../deployment/source-build.md). |

## Completion Outcome

A developer who follows this map should be able to start the service, configure ChatGPT Apps, configure GPT Actions, explain account linking, add a shared capability, verify the changed surface, and prepare the change for release.

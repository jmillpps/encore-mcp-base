# Development

This section supports developers and maintainers who change the service. It defines code ownership, extension workflow, security review, tests, documentation rules, and release readiness.

## Development Reading Order

| Step | Read | Purpose |
| --- | --- | --- |
| 1 | [Developer Critical Areas](developer-critical-areas.md) | Choose the right learning path for the task. |
| 2 | [Project Structure](project-structure.md) | Locate code ownership, dependency boundaries, tests, tools, and docs. |
| 3 | [Request Lifecycle](request-lifecycle.md) | Trace OAuth, MCP, Actions, shared capabilities, diagnostics, and storage interactions. |
| 4 | [Adding Capabilities](adding-capabilities.md) | Follow the shared-behavior and protocol-adapter pattern. |
| 5 | [MCP Tool Development](mcp-tool-development.md) | Add GPT Apps tools with descriptors, schemas, scopes, auth challenges, and live tests. |
| 6 | [MCP Apps UI Resources](mcp-app-ui-resources.md) | Add ChatGPT-rendered UI resources with descriptors, CSP metadata, scopes, and live tests. |
| 7 | [Actions Endpoint Development](actions-endpoint-development.md) | Add GPT Actions endpoints with Encore routes, bearer validation, OpenAPI operations, and live tests. |
| 8 | [Shared Types And Schemas](shared-types-schemas.md) | Preserve shared request, response, identity, tool, and OpenAPI shapes. |
| 9 | [Security Review](security-review.md) | Review trust boundaries, secrets, tokens, diagnostics, rate limits, and attacker-controlled input. |
| 10 | [Testing](testing.md) | Select targeted live tests and the full release gate. |
| 11 | [Change Readiness](change-readiness.md) | Confirm commit scope, verification evidence, docs, release readiness, and tree state. |

## Maintainer Reading Order

| Step | Read | Purpose |
| --- | --- | --- |
| 1 | [Maintainer Critical Areas](maintainer-critical-areas.md) | Understand high-risk project areas and their owning docs. |
| 2 | [Identity Provider Testing](identity-provider-testing.md) | Understand local upstream OIDC proof for generic provider behavior. |
| 3 | [Documentation Standards](documentation.md) | Keep documentation modular, direct, generic, and separate from code. |
| 4 | [External References](../reference/external-references.md) | Check authoritative sources before changing protocol or platform guidance. |

## Change Boundaries

| Change type | Primary guide | Required follow-up docs |
| --- | --- | --- |
| New MCP tool | [MCP Tool Development](mcp-tool-development.md) | [MCP API Reference](../api/mcp.md), [GPT Apps Setup](../user-guides/gpt-apps.md) |
| New MCP UI resource | [MCP Apps UI Resources](mcp-app-ui-resources.md) | [MCP API Reference](../api/mcp.md), [GPT Apps Setup](../user-guides/gpt-apps.md), [Capabilities](../architecture/capabilities.md) |
| New Actions endpoint | [Actions Endpoint Development](actions-endpoint-development.md) | [Actions API Reference](../api/actions.md), [OpenAPI Contract](../api/openapi.md) |
| Shared capability | [Adding Capabilities](adding-capabilities.md) | [Capabilities](../architecture/capabilities.md), affected API docs |
| OAuth behavior | [Request Lifecycle](request-lifecycle.md), [Security Review](security-review.md) | [OAuth API Reference](../api/oauth.md), [OAuth Provider](../architecture/oauth-provider.md) |
| Deployment behavior | [Change Readiness](change-readiness.md) | [Deployment](../deployment/index.md), [Release Verification](../deployment/release-verification.md) |

## Development Slice Flow

| Step | Outcome |
| --- | --- |
| Define the surface | Identify the owning directory, protocol surface, security boundary, and tests before editing. |
| Implement the shared behavior | Keep reusable behavior in the narrowest shared module. |
| Add protocol adapters | Add MCP or Actions adapters only for the surfaces that need exposure. |
| Update documentation | Update the API, architecture, guide, maintenance, or deployment page owned by the changed behavior. |
| Run targeted checks | Run tests and static checks that prove the changed behavior. |
| Commit the slice | Commit one coherent feature, fix, refactor, test, or documentation slice. |

## File Ownership Rule

Use file and folder names that identify the owned behavior. Keep implementation files small enough to review as one unit. Move durable explanation into docs and keep code readable through names, types, validation functions, and focused modules.

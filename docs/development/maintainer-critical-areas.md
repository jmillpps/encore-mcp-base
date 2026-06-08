# Maintainer Critical Areas

This guide gives maintainers the project map for the areas that carry the most operational, security, and compatibility risk.

## Area Map

| Area | Maintainer focus | Primary docs |
| --- | --- | --- |
| Project purpose and surfaces | Know the service purpose, ChatGPT Apps surface, ChatGPT Actions surface, and documentation entrypoints. | [Overview](../architecture/overview.md), [API Index](../api/index.md), [Deployment Index](../deployment/index.md) |
| Runtime ownership boundaries | Keep feature roots focused and preserve dependency direction between `shared/`, `auth/`, `mcp/`, and `actions/`. | [Project Structure](project-structure.md), [Architecture Overview](../architecture/overview.md) |
| OAuth provider architecture | Understand authorization, token issuance, client resolution, refresh rotation, discovery, JWKS, userinfo, and OAuth errors. | [OAuth Provider](../architecture/oauth-provider.md), [OAuth API](../api/oauth.md) |
| Upstream identity provider model | Maintain the generic upstream OIDC contract and the service-owned `/oauth/callback` path. | [Identity Provider](../deployment/identity-provider.md), [Identity Profile](../api/identity-profile.md) |
| Token audience and scope rules | Preserve MCP and Actions audience separation, resource binding, and scope checks. | [Security Model](../architecture/security-model.md), [Capabilities](../architecture/capabilities.md) |
| MCP transports | Maintain Streamable HTTP, legacy HTTP/SSE, session behavior, JSON-RPC validation, and SSE lifetime rules. | [MCP Transports](../architecture/mcp-transports.md), [MCP API](../api/mcp.md) |
| GPT Actions and OpenAPI | Keep REST endpoints and the generated OpenAPI document aligned with ChatGPT Actions expectations. | [Actions And OpenAPI](../architecture/actions-openapi.md), [OpenAPI Contract](../api/openapi.md) |
| Capability development pattern | Implement shared behavior once and expose it through focused MCP and Actions adapters. | [Adding Capabilities](adding-capabilities.md), [Capabilities](../architecture/capabilities.md) |
| Configuration and startup validation | Keep production startup fail-closed for unsafe URLs, missing secrets, unsafe keys, missing clients, and invalid lifetimes. | [Configuration Reference](../api/configuration.md), [Production Deployment](../deployment/production.md) |
| Durable state and recovery | Preserve OAuth store permissions, hashed state values, lock handling, atomic writes, backup, and restore rules. | [Storage Model](../architecture/storage-model.md), [Storage Maintenance](../maintenance/storage.md) |
| Secrets and signing keys | Manage raw secrets, signing keys, public key rotation, JWKS continuity, and safe rollback. | [Signing Key Rotation](../maintenance/key-rotation.md), [Runtime Parameters](../deployment/runtime-parameters.md) |
| AWS CDK deployment | Maintain CDK inputs, identity provider modes, stack resources, stack outputs, and operator-owned value boundaries. | [AWS CDK Deployment](../deployment/aws-cdk.md), [CDK Operations](../deployment/cdk-operations.md) |
| Runtime parameters and Parameter Store | Understand String and SecureString parameter ownership, runtime load behavior, and restart requirements. | [Runtime Parameters](../deployment/runtime-parameters.md) |
| Release and operations flow | Follow preflight, synth, diff, deploy, seed, build, restart, public verification, and failure review steps. | [CDK Operations](../deployment/cdk-operations.md), [Release Verification](../deployment/release-verification.md) |
| Test strategy | Run targeted checks during changes and the full gate before release. Keep tests tied to live behavior. | [Testing](testing.md) |
| Identity provider test harness | Understand the local upstream OIDC test provider and the proof it gives for generic IdP behavior. | [Identity Provider Testing](identity-provider-testing.md) |
| Client metadata risk | Treat remote client metadata, remote JWKS, and client assertions as untrusted inputs. | [Client Metadata Maintenance](../maintenance/client-metadata.md) |
| Diagnostics, errors, and rate limits | Use safe diagnostics, client-safe errors, durable rate limits, and scoped troubleshooting order. | [Diagnostics And Rate Limits](../maintenance/diagnostics-rate-limits.md), [Security Model](../architecture/security-model.md) |
| Source build and release discipline | Keep the source archive tied to committed `HEAD`, CodeBuild, ECR, and runtime image pull behavior. | [Source Build](../deployment/source-build.md) |
| Documentation and project discipline | Keep docs modular, direct, generic, and separate from code. Review prose by reading. | [Documentation Standards](documentation.md) |

## Review Order

Use this order when onboarding or reviewing a broad change:

1. Read [Architecture Overview](../architecture/overview.md) for service boundaries.
2. Read [Security Model](../architecture/security-model.md) for trust boundaries.
3. Read the protocol document for the changed surface.
4. Read the deployment or maintenance document for operational impact.
5. Read [Testing](testing.md) for the right verification scope.
6. Read [Documentation Standards](documentation.md) before changing docs.

## Change Discipline

Every change should preserve these rules:

- One current implementation path for each feature.
- Focused files with clear ownership.
- Shared behavior in shared modules.
- Protocol-specific behavior in protocol adapters.
- Real tests for service behavior.
- Documentation under `docs/` with generic examples.
- Private deployment values stay out of repository docs.

## Maintainer Proof Points

| Area | Proof to require before merge |
| --- | --- |
| OAuth | Authorization, token, refresh, userinfo, discovery, and client-auth tests pass for the changed behavior. |
| MCP | Streamable HTTP, legacy transport when affected, tool descriptor, auth challenge, session, and request-ID tests pass. |
| Actions | OpenAPI compatibility, Actions auth, endpoint behavior, and error-shape tests pass. |
| Identity provider | Local upstream OIDC tests prove generic provider behavior and claim normalization. |
| Deployment | CDK synthesis or targeted CDK tests prove infrastructure changes. |
| Storage | Store permissions, locking, atomic writes, expiration, and replay behavior remain covered. |
| Security | Input validation, least privilege, secret handling, diagnostics redaction, and rate-limit behavior are reviewed. |
| Documentation | Affected docs are read manually and match the implementation and official sources. |

## Risk Triggers

| Trigger | Extra review |
| --- | --- |
| New public endpoint | API docs, security review, OpenAPI or MCP surface docs, and live endpoint tests. |
| New scope or audience | OAuth docs, client registry docs, token tests, Actions or MCP auth tests, and setup guides. |
| New secret or parameter | Runtime parameter docs, deployment docs, Parameter Store handling, and redaction review. |
| New external URL fetch | SSRF review, DNS behavior, timeout, size limit, cache behavior, and failure tests. |
| Store schema change | Migration plan, backup and restore notes, compatibility review, and store tests. |

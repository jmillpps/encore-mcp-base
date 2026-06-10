# External References

This page lists authoritative external specifications and official service documentation used by the project docs. Use it before changing protocol, platform, deployment, authentication, authorization, or schema guidance.

## MCP And ChatGPT Apps

| Source | Use for | Project docs |
| --- | --- | --- |
| [MCP Transports, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) | Streamable HTTP, POST and GET behavior, SSE behavior, sessions, protocol-version header, and legacy HTTP/SSE compatibility. | [MCP API Reference](../api/mcp.md), [MCP Transports](../architecture/mcp-transports.md) |
| [MCP Authorization, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) | Protected resource metadata, authorization server discovery, resource indicators, client metadata documents, DCR, bearer-token rules, and scope challenges. | [OAuth API Reference](../api/oauth.md), [OAuth Provider](../architecture/oauth-provider.md), [Client Metadata Maintenance](../maintenance/client-metadata.md) |
| [MCP Lifecycle, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) | Initialize flow, protocol negotiation, capability negotiation, initialized notification, operation, shutdown, timeouts, and errors. | [MCP API Reference](../api/mcp.md), [Request Lifecycle](../development/request-lifecycle.md) |
| [MCP Tools, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) | Tool listing, descriptors, input schemas, structured content, output schemas, result validation, and tool execution errors. | [MCP API Reference](../api/mcp.md), [MCP Tool Development](../development/mcp-tool-development.md) |
| [MCP Resources, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) | Resource capability advertisement, resource listing, resource reading, resource templates, resource URI validation, annotations, and resource errors. | [MCP API Reference](../api/mcp.md), [MCP Apps UI Resources](../development/mcp-app-ui-resources.md) |
| [OpenAI Apps SDK Authentication](https://developers.openai.com/apps-sdk/build/auth) | ChatGPT app OAuth, protected resource metadata, resource echoing, CIMD, DCR, PKCE, token verification, auth challenges, and tool-level auth UI behavior. | [GPT Apps Setup](../user-guides/gpt-apps.md), [Client Metadata Maintenance](../maintenance/client-metadata.md) |
| [OpenAI Apps SDK MCP Server Guide](https://developers.openai.com/apps-sdk/build/mcp-server) | App resources, UI MIME type, `_meta.ui.resourceUri`, CSP metadata, UI resource versioning, render tools, and ChatGPT compatibility aliases. | [MCP Apps UI Resources](../development/mcp-app-ui-resources.md), [GPT Apps Setup](../user-guides/gpt-apps.md) |
| [OpenAI Apps SDK Reference](https://developers.openai.com/apps-sdk/reference) | Tool descriptor `_meta` fields, component resource `_meta` fields, widget CSP aliases, tool result fields, and component-only metadata behavior. | [MCP API Reference](../api/mcp.md), [MCP Apps UI Resources](../development/mcp-app-ui-resources.md) |
| [OpenAI ChatGPT UI Guide](https://developers.openai.com/apps-sdk/build/chatgpt-ui) | Component iframe behavior, `window.openai`, component tool calls, model-visible context updates, and decoupled data/render tool patterns. | [GPT Apps Setup](../user-guides/gpt-apps.md), [MCP Apps UI Resources](../development/mcp-app-ui-resources.md) |
| [OpenAI ChatGPT Developer Mode](https://developers.openai.com/api/docs/guides/developer-mode#how-to-use) | Creating apps from MCP servers, supported MCP protocols, OAuth modes, tool refresh, read-only tool handling, and server instructions guidance. | [GPT Apps Setup](../user-guides/gpt-apps.md), [MCP Tool Development](../development/mcp-tool-development.md) |
| [OpenAI MCP Server Guide](https://developers.openai.com/api/docs/mcp) | Remote MCP server use with ChatGPT Apps and API integrations, data-only app behavior, ChatGPT app setup links, and custom MCP risk guidance. | [GPT Apps Setup](../user-guides/gpt-apps.md), [Security Model](../architecture/security-model.md) |

## GPT Actions And OpenAPI

| Source | Use for | Project docs |
| --- | --- | --- |
| [OpenAI GPT Action Authentication](https://developers.openai.com/api/docs/actions/authentication#oauth) | GPT Actions OAuth fields, callback URLs, token passing, refresh tokens, state parameter, and login troubleshooting. | [GPT Actions Setup](../user-guides/gpt-actions.md), [Actions API Reference](../api/actions.md) |
| [OpenAI GPT Actions Library Guidance](https://developers.openai.com/api/docs/actions/actions-library#contribute-to-our-library) | Action documentation structure, OpenAPI schema expectations, OAuth setup fields, and troubleshooting coverage. | [GPT Actions Setup](../user-guides/gpt-actions.md), [OpenAPI Contract](../api/openapi.md) |
| [OpenAPI Specification 3.1.0](https://spec.openapis.org/oas/v3.1.0.html) | OpenAPI document structure, paths, operations, security schemes, OAuth flows, schemas, and JSON Schema alignment. | [OpenAPI Contract](../api/openapi.md), [Actions Endpoint Development](../development/actions-endpoint-development.md) |
| [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) | JSON Schema vocabulary and schema dialect behavior used by OpenAPI 3.1 and MCP schemas. | [Shared Types And Schemas](../development/shared-types-schemas.md), [MCP Tool Development](../development/mcp-tool-development.md) |

## OAuth And OIDC

| Source | Use for | Project docs |
| --- | --- | --- |
| [RFC 8414, OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414) | Authorization server discovery metadata, issuer, authorization endpoint, token endpoint, JWKS URI, scopes, grant types, and token endpoint auth methods. | [OAuth API Reference](../api/oauth.md), [OAuth Provider](../architecture/oauth-provider.md) |
| [RFC 9728, OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728) | Protected resource metadata, `resource`, authorization servers, resource documentation, and `WWW-Authenticate` discovery. | [MCP API Reference](../api/mcp.md), [Security Model](../architecture/security-model.md) |
| [RFC 8707, Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707) | `resource` parameter handling and audience binding for access tokens. | [OAuth API Reference](../api/oauth.md), [Configuration Reference](../api/configuration.md) |
| [RFC 7636, Proof Key for Code Exchange](https://www.rfc-editor.org/rfc/rfc7636) | PKCE challenge and verifier handling for authorization-code flows. | [OAuth API Reference](../api/oauth.md), [Client Registry](../deployment/client-registry.md) |
| [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) | ID tokens, userinfo, scopes, subject, nonce, auth time, and OIDC claims. | [Identity Profile](../api/identity-profile.md), [OAuth API Reference](../api/oauth.md) |
| [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html) | `.well-known/openid-configuration` metadata and issuer discovery behavior. | [OAuth API Reference](../api/oauth.md), [Identity Provider](../deployment/identity-provider.md) |

## Encore TypeScript Runtime

| Source | Use for | Project docs |
| --- | --- | --- |
| [Encore TypeScript Services](https://encore.dev/docs/ts/primitives/services) | Service root structure and Encore service ownership. | [Project Structure](../development/project-structure.md), [Architecture Overview](../architecture/overview.md) |
| [Encore TypeScript API Definitions](https://encore.dev/docs/ts/primitives/defining-apis) | Typed APIs, exposed endpoints, custom status behavior, sensitive endpoint behavior, and raw endpoint entrypoints. | [Actions Endpoint Development](../development/actions-endpoint-development.md), [Configuration Reference](../api/configuration.md) |
| [Encore Raw Endpoints](https://encore.dev/docs/ts/primitives/raw-endpoints) | Raw HTTP request and response handling used by OAuth, MCP, SSE, privacy, and OpenAPI endpoints. | [MCP Transports](../architecture/mcp-transports.md), [OpenAPI Contract](../api/openapi.md) |
| [Encore Streaming APIs](https://encore.dev/docs/ts/primitives/streaming-apis) | Encore streaming concepts and runtime distinction from raw SSE endpoints. | [MCP Transports](../architecture/mcp-transports.md), [Project Structure](../development/project-structure.md) |

## AWS And Deployment

| Source | Use for | Project docs |
| --- | --- | --- |
| [AWS CDK v2 Developer Guide](https://docs.aws.amazon.com/cdk/v2/guide/home.html) | CDK application model, stack synthesis, diff, deploy, and destroy workflows. | [AWS CDK Deployment](../deployment/aws-cdk.md), [CDK Operations](../deployment/cdk-operations.md) |
| [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html) | Runtime configuration storage, parameter hierarchy, parameter types, and operational use. | [Runtime Parameters](../deployment/runtime-parameters.md), [Production Deployment](../deployment/production.md) |
| [AWS KMS For Parameter Store SecureString](https://docs.aws.amazon.com/systems-manager/latest/userguide/secure-string-parameter-kms-encryption.html) | SecureString encryption, customer managed keys, decrypt permissions, and KMS behavior. | [Runtime Parameters](../deployment/runtime-parameters.md), [Signing Key Rotation](../maintenance/key-rotation.md) |
| [AWS Systems Manager Parameter Access Control](https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-access.html) | Least-privilege IAM policy behavior for Parameter Store reads and SecureString access. | [AWS CDK Deployment](../deployment/aws-cdk.md), [Runtime Parameters](../deployment/runtime-parameters.md) |
| [DynamoDB NoSQL Design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html) | Access-pattern-first table design, table count guidance, locality, sort order, and partition distribution. | [DynamoDB Store](../architecture/dynamodb-store.md), [Storage Model](../architecture/storage-model.md) |
| [DynamoDB Single Table Design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-foundations.html) | Single-table foundation, item collections, table management, capacity, monitoring, and encryption key scope. | [DynamoDB Store](../architecture/dynamodb-store.md), [AWS CDK Deployment](../deployment/aws-cdk.md) |
| [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html) | TTL attribute rules, Unix epoch seconds, and item expiration behavior. | [DynamoDB Store](../architecture/dynamodb-store.md), [Storage Maintenance](../maintenance/storage.md) |
| [DynamoDB Transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html) | `TransactWriteItems`, all-or-nothing writes, transaction limits, and index behavior. | [DynamoDB Store](../architecture/dynamodb-store.md) |
| [DynamoDB Encryption At Rest](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/EncryptionAtRest.html) | KMS encryption at rest, table encryption scope, backups, and indexes. | [DynamoDB Store](../architecture/dynamodb-store.md), [AWS CDK Deployment](../deployment/aws-cdk.md) |
| [DynamoDB Encryption Best Practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/encryption-best-practices/dynamodb.html) | Customer-managed KMS key guidance and encryption control considerations. | [DynamoDB Store](../architecture/dynamodb-store.md), [AWS CDK Deployment](../deployment/aws-cdk.md) |
| [Security Hub DynamoDB Controls](https://docs.aws.amazon.com/securityhub/latest/userguide/dynamodb-controls.html) | PITR, backup, tagging, and data-protection control expectations. | [DynamoDB Store](../architecture/dynamodb-store.md), [Storage Maintenance](../maintenance/storage.md) |
| [Amazon EC2 User Data](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html) | Instance bootstrap behavior and user data execution expectations. | [AWS CDK Deployment](../deployment/aws-cdk.md), [Source Build](../deployment/source-build.md) |
| [Amazon ECR User Guide](https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html) | Container image repository behavior and image pull expectations. | [Source Build](../deployment/source-build.md), [CDK Operations](../deployment/cdk-operations.md) |
| [AWS CodeBuild User Guide](https://docs.aws.amazon.com/codebuild/latest/userguide/welcome.html) | Managed build project behavior and image build verification. | [Source Build](../deployment/source-build.md), [AWS CDK Deployment](../deployment/aws-cdk.md) |
| [Caddy Documentation](https://caddyserver.com/docs/) | HTTPS termination, reverse proxy behavior, and streaming proxy considerations. | [Production Deployment](../deployment/production.md), [Release Verification](../deployment/release-verification.md) |

## Review Rules

- Prefer these links over blog posts, forum posts, and copied snippets.
- Re-check OpenAI and MCP pages when ChatGPT Apps, GPT Actions, MCP transports, or OAuth setup behavior changes.
- Re-check AWS pages when stack resources, parameter loading, KMS policies, or instance bootstrap behavior changes.
- Keep project documentation grounded in current implementation and these source documents.

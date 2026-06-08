# Documentation

GPT MCP Service is a private ChatGPT integration service. It provides OAuth, MCP for GPT Apps, OpenAPI-backed REST endpoints for GPT Actions, secure token storage, production validation, and focused developer tooling.

The documentation is organized by reader task.

## User Guides

- [User Guides](user-guides/index.md) lists beginner workflows.
- [Local Development](user-guides/local-development.md) runs the service locally and verifies the first request.
- [GPT Apps Setup](user-guides/gpt-apps.md) connects ChatGPT to the MCP endpoint.
- [GPT Actions Setup](user-guides/gpt-actions.md) exports the OpenAPI schema and links OAuth.

## API

- [API Documentation](api/index.md) lists the public protocol surfaces.
- [OAuth API Reference](api/oauth.md) lists OAuth and OIDC endpoints.
- [MCP API Reference](api/mcp.md) lists MCP endpoints, protocol behavior, and tools.
- [Actions API Reference](api/actions.md) lists REST endpoints and OpenAPI behavior.
- [Identity Profile](api/identity-profile.md) lists profile claim behavior.
- [Configuration Reference](api/configuration.md) lists runtime environment variables.
- [OpenAPI Contract](api/openapi.md) describes the generated Actions schema.

## Architecture

- [Architecture](architecture/index.md) lists system design topics.
- [Overview](architecture/overview.md) explains the service layout and trust boundaries.
- [OAuth Provider](architecture/oauth-provider.md) explains authorization, token issuance, resources, and OIDC.
- [MCP Transports](architecture/mcp-transports.md) explains Streamable HTTP and legacy HTTP/SSE.
- [Actions And OpenAPI](architecture/actions-openapi.md) explains the REST surface for GPT Actions.
- [Capabilities](architecture/capabilities.md) explains shared behavior and endpoint adapters.
- [Security Model](architecture/security-model.md) explains security boundaries.
- [Storage Model](architecture/storage-model.md) explains durable state design.

## Deployment

- [Deployment](deployment/index.md) lists deployment guides.
- [Production Deployment](deployment/production.md) covers production environment setup.
- [AWS CDK Deployment](deployment/aws-cdk.md) covers the EC2, Route53, Cognito, ECR, CodeBuild, and Parameter Store deployment path.
- [CDK Operations](deployment/cdk-operations.md) covers deployment, update, restart, and teardown commands.
- [Runtime Parameters](deployment/runtime-parameters.md) covers Parameter Store values, secrets, runtime files, and restarts.
- [Source Build](deployment/source-build.md) covers source archives, CodeBuild image builds, ECR, and runtime pulls.
- [Cognito Upstream Login](deployment/cognito-upstream.md) covers the Cognito hosted login bridge.
- [Release Verification](deployment/release-verification.md) covers post-deployment checks for infrastructure, runtime, Apps, and Actions.
- [Client Registry](deployment/client-registry.md) covers production OAuth client records.
- [OpenAPI Export](deployment/openapi-export.md) covers Actions schema generation.

## Development

- [Development](development/index.md) lists maintainer guides.
- [Project Structure](development/project-structure.md) maps code ownership.
- [Adding Capabilities](development/adding-capabilities.md) explains MCP and Actions adapters.
- [Testing](development/testing.md) explains targeted and full verification.
- [Documentation Standards](development/documentation.md) explains repository documentation rules.

## Maintenance

- [Maintenance](maintenance/index.md) lists operator runbooks.
- [Signing Key Rotation](maintenance/key-rotation.md) covers active and previous key handling.
- [Storage Maintenance](maintenance/storage.md) covers store permissions and lock handling.
- [Client Metadata Maintenance](maintenance/client-metadata.md) covers metadata and JWKS retrieval risks.
- [Diagnostics And Rate Limits](maintenance/diagnostics-rate-limits.md) covers safe operational signals.

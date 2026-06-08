# Deployment

This section covers production setup and deployment-time artifacts.

- [Production Deployment](production.md) covers environment variables, clients, and release checks.
- [AWS CDK Deployment](aws-cdk.md) covers the EC2, Route53, identity provider mode, ECR, CodeBuild, and Parameter Store deployment path.
- [CDK Operations](cdk-operations.md) covers deployment, update, restart, and teardown commands.
- [Runtime Parameters](runtime-parameters.md) covers Parameter Store values, secrets, runtime files, and restarts.
- [Source Build](source-build.md) covers source archives, CodeBuild image builds, ECR, and runtime pulls.
- [Identity Provider](identity-provider.md) covers upstream OIDC provider setup and optional CDK Cognito mode.
- [Release Verification](release-verification.md) covers post-deployment checks for infrastructure, runtime, Apps, and Actions.
- [Client Registry](client-registry.md) covers production OAuth client records.
- [OpenAPI Export](openapi-export.md) covers GPT Actions schema generation.

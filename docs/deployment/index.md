# Deployment

This section covers production setup and deployment-time artifacts.

- [Production Deployment](production.md) covers environment variables, clients, and release checks.
- [AWS CDK Deployment](aws-cdk.md) covers the EC2, Route53, Cognito, ECR, CodeBuild, and Parameter Store deployment path.
- [CDK Operations](cdk-operations.md) covers deployment, update, restart, and teardown commands.
- [Runtime Parameters](runtime-parameters.md) covers Parameter Store values, secrets, runtime files, and restarts.
- [Source Build](source-build.md) covers source archives, CodeBuild image builds, ECR, and runtime pulls.
- [Cognito Upstream Login](cognito-upstream.md) covers the Cognito hosted login bridge.
- [Release Verification](release-verification.md) covers post-deployment checks for infrastructure, runtime, Apps, and Actions.
- [Client Registry](client-registry.md) covers production OAuth client records.
- [OpenAPI Export](openapi-export.md) covers GPT Actions schema generation.

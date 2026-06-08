# Deployment

This section covers production setup, AWS deployment, runtime configuration, identity provider setup, image release, and post-deployment verification.

## Deployment Reading Order

| Step | Read | Purpose |
| --- | --- | --- |
| 1 | [Production Deployment](production.md) | Understand the required public URLs, OAuth clients, upstream OIDC values, storage, origins, keys, limits, and release checks. |
| 2 | [Identity Provider](identity-provider.md) | Select external OIDC mode or CDK Cognito mode and register the service callback. |
| 3 | [Client Registry](client-registry.md) | Create production OAuth client records for GPT Apps, GPT Actions, static clients, and metadata-document clients. |
| 4 | [AWS CDK Deployment](aws-cdk.md) | Understand stack inputs, resources, identity provider modes, Parameter Store, outputs, and teardown. |
| 5 | [CDK Operations](cdk-operations.md) | Run synth, diff, deploy, seed, build, restart, update, and destroy commands in the right order. |
| 6 | [Runtime Parameters](runtime-parameters.md) | Understand String and SecureString parameters, runtime file placement, secret retrieval, and restarts. |
| 7 | [Source Build](source-build.md) | Package source, build the image through CodeBuild, push to ECR, and restart the runtime container. |
| 8 | [OpenAPI Export](openapi-export.md) | Export or serve the GPT Actions schema with the deployed base URL. |
| 9 | [Release Verification](release-verification.md) | Verify infrastructure, runtime endpoints, OAuth metadata, GPT Apps, GPT Actions, logs, and rollback readiness. |

## Deployment Ownership

| Area | Owning docs | External source map |
| --- | --- | --- |
| Public runtime requirements | [Production Deployment](production.md), [Configuration Reference](../api/configuration.md) | [External References](../reference/external-references.md#oauth-and-oidc) |
| AWS infrastructure | [AWS CDK Deployment](aws-cdk.md), [CDK Operations](cdk-operations.md) | [External References](../reference/external-references.md#aws-and-deployment) |
| Runtime secrets | [Runtime Parameters](runtime-parameters.md), [Signing Key Rotation](../maintenance/key-rotation.md) | [External References](../reference/external-references.md#aws-and-deployment) |
| ChatGPT setup | [GPT Apps Setup](../user-guides/gpt-apps.md), [GPT Actions Setup](../user-guides/gpt-actions.md) | [External References](../reference/external-references.md#mcp-and-chatgpt-apps) |

Keep operator-specific account IDs, domains, hosted zones, resource IDs, stack names, parameter paths, client secrets, and identity provider tenant values outside tracked files.

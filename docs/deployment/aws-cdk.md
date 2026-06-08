# AWS CDK Deployment

The CDK deployment provisions the production service on one EC2 instance with Route53 DNS, Cognito hosted login, ECR image storage, CodeBuild image builds, Caddy HTTPS termination, and AWS Systems Manager Parameter Store runtime configuration.

## Required Deployment Inputs

Set these values before running CDK commands:

| Variable | Purpose |
| --- | --- |
| `CDK_APP_NAME` | Lowercase deployment resource prefix. |
| `CDK_ENVIRONMENT_NAME` | Lowercase deployment environment name. |
| `CDK_SERVICE_NAME` | Lowercase EC2 service, container, and runtime directory name. |
| `CDK_STACK_NAME` | CloudFormation stack name. |
| `CDK_DEFAULT_ACCOUNT` | AWS account selected by the authenticated CDK environment. |
| `CDK_DEFAULT_REGION` | AWS region selected by the authenticated CDK environment. |
| `CDK_DOMAIN_NAME` | Public service hostname. |
| `CDK_HOSTED_ZONE_ID` | Route53 hosted zone ID for the service hostname. |
| `CDK_HOSTED_ZONE_NAME` | Route53 hosted zone name for the service hostname. |
| `CDK_COGNITO_DOMAIN_PREFIX` | Globally unique Cognito hosted UI domain prefix. |
| `CDK_PARAMETER_PREFIX` | Parameter Store path for runtime configuration. |
| `CDK_INSTANCE_TYPE` | EC2 instance type. |

Optional deployment inputs:

| Variable | Purpose |
| --- | --- |
| `CDK_ALLOWED_ORIGINS` | Browser origins allowed by the service. Default allows ChatGPT origins. |

`CDK_APP_NAME` and `CDK_ENVIRONMENT_NAME` form AWS resource names. `CDK_SERVICE_NAME` controls the systemd unit name, Docker container name, runtime directories, OAuth store path, and bootstrap logs on the EC2 instance.

Store operator-specific values in an ignored local shell file, CI secret store, or secure operator runbook. Keep account IDs, hosted zone IDs, real domains, Cognito prefixes, stack names, and parameter paths out of tracked source files.

## Input Validation

CDK inputs are validated before synthesis:

| Input group | Validation |
| --- | --- |
| Resource names | Lowercase letters, numbers, and dashes. |
| Stack name | CloudFormation-compatible stack name. |
| Domain names | Lowercase hostnames inside the configured hosted zone. |
| Hosted zone ID | Route53 hosted zone ID characters. |
| Parameter prefix | Absolute Parameter Store path with no reserved prefix. |
| Instance type | EC2 instance type shape. |

`CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION` must be explicit in the operator environment. CDK synthesis reads deployment identity from the operator environment.

## Stack Resources

The stack creates:

| Resource | Purpose |
| --- | --- |
| KMS key | Encrypt SecureString runtime parameters. |
| ECR repository | Store built service images. |
| S3 source bucket | Store the uploaded source archive for CodeBuild. |
| Cognito user pool | Host the upstream login directory. |
| Cognito app client | Provide the upstream OAuth client. |
| Cognito hosted UI domain | Serve Cognito browser login. |
| VPC and public subnet | Place the single EC2 instance. |
| Security group | Allow inbound `80` and `443`. |
| EC2 role | Read the runtime parameter path and pull images. |
| EC2 instance | Run the containerized service. |
| Elastic IP | Provide a stable DNS target. |
| Route53 A record | Point the service hostname to the Elastic IP. |
| CodeBuild project | Build and push the ARM64 service image. |
| Parameter Store values | Provide runtime configuration. |

The EC2 instance uses Amazon Linux 2023 ARM64, encrypted GP3 root storage, IMDSv2, Docker, Caddy, and a systemd-managed service container.

## Parameter Store

Runtime configuration lives under the stack output `ParameterPrefix`. Sensitive values use SecureString parameters encrypted by the stack KMS key. The EC2 instance role can read this parameter path and decrypt with this key.

The bootstrap process writes the signing private key to an instance-local file and sets `OAUTH_PRIVATE_KEY_PEM_FILE` for the container. The raw key stays out of source files and deployment command output.

Runtime parameter details are covered in [Runtime Parameters](runtime-parameters.md).

## Seed Runtime Parameters

After deployment, seed runtime parameters with ChatGPT redirect URIs:

```sh
npm --prefix ci/cdk run seed:parameters -- \
  --actions-client-id "$ACTIONS_CLIENT_ID" \
  --actions-redirect-uri "$ACTIONS_REDIRECT_URI" \
  --mcp-client-id "$MCP_CLIENT_ID" \
  --mcp-redirect-uri "$MCP_REDIRECT_URI"
```

The command creates GPT Actions and GPT Apps OAuth client secrets. Read those secrets from the printed Parameter Store names when configuring ChatGPT.

## Build And Run

Upload source and trigger the container build:

```sh
npm --prefix ci/cdk run build:image -- \
  --stack-name "$CDK_STACK_NAME" \
  --image-tag "$IMAGE_TAG"
```

Restart the instance service after the image build completes:

```sh
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters commands='["systemctl restart SERVICE_NAME.service"]'
```

Source archive and CodeBuild behavior are covered in [Source Build](source-build.md).

Full command sequencing is covered in [CDK Operations](cdk-operations.md).

## Public Endpoints

After deployment, verify these public read-only URLs:

```sh
curl https://service.example.com/health
curl https://service.example.com/.well-known/openid-configuration
curl https://service.example.com/.well-known/oauth-protected-resource/mcp
curl https://service.example.com/actions/openapi.json
```

Use the deployed `/actions/openapi.json` URL for GPT Actions URL import. The document uses the deployed issuer URL in `servers`, authorization URL, and token URL.

## Stack Outputs

The stack publishes outputs for the public URL, MCP resource, Actions audience, Parameter Store prefix, KMS key, ECR repository, source bucket, CodeBuild project, EC2 instance, Elastic IP, Cognito user pool, Cognito client, and Cognito hosted UI base URL.

Cognito bridge details are covered in [Cognito Upstream Login](cognito-upstream.md). Release checks are covered in [Release Verification](release-verification.md).

## Teardown

Destroy the stack from the same configured environment:

```sh
npm --prefix ci/cdk run destroy
```

Parameter values, the EC2 instance, DNS record, Cognito user pool, ECR repository, source bucket, KMS key, and generated build resources are stack-owned.

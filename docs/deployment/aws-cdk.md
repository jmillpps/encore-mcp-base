# AWS CDK Deployment

The CDK deployment provisions the production service on one EC2 instance with Route53 DNS, Cognito hosted login, ECR image storage, CodeBuild image builds, and Systems Manager Parameter Store runtime configuration.

## Required Deployment Inputs

Set these values before running CDK commands:

| Variable | Purpose |
| --- | --- |
| `CDK_DEFAULT_ACCOUNT` | AWS account selected by the authenticated CDK environment. |
| `CDK_DEFAULT_REGION` | AWS region selected by the authenticated CDK environment. |
| `CDK_DOMAIN_NAME` | Public service hostname. |
| `CDK_HOSTED_ZONE_ID` | Route53 hosted zone ID for the service hostname. |
| `CDK_HOSTED_ZONE_NAME` | Route53 hosted zone name for the service hostname. |
| `CDK_COGNITO_DOMAIN_PREFIX` | Globally unique Cognito hosted UI domain prefix. |

Optional deployment inputs:

| Variable | Purpose |
| --- | --- |
| `CDK_APP_NAME` | Resource name prefix. Default is `gpt-mcp-service`. |
| `CDK_ENVIRONMENT_NAME` | Environment name. Default is `prod`. |
| `CDK_STACK_NAME` | CloudFormation stack name. Default is derived from `CDK_APP_NAME` and `CDK_ENVIRONMENT_NAME`. |
| `CDK_PARAMETER_PREFIX` | Parameter Store path. Default is `/$CDK_APP_NAME/$CDK_ENVIRONMENT_NAME/env`. |
| `CDK_INSTANCE_TYPE` | EC2 instance type. Default is `t4g.micro`. |
| `CDK_ALLOWED_ORIGINS` | Browser origins allowed by the service. Default allows ChatGPT origins. |

## Parameter Store

Runtime configuration lives under the stack output `ParameterPrefix`. Sensitive values use SecureString parameters encrypted by the stack KMS key. The EC2 instance role can read only this parameter path and decrypt with this key.

The bootstrap process writes the signing private key to an instance-local file and sets `OAUTH_PRIVATE_KEY_PEM_FILE` for the container. The raw key stays out of source files and deployment command output.

## Seed Runtime Parameters

After deployment, seed runtime parameters with ChatGPT redirect URIs:

```sh
npm --prefix ci/cdk run seed:parameters -- \
  --actions-redirect-uri https://chatgpt.com/aip/g-prod/oauth/callback \
  --mcp-redirect-uri https://chatgpt.com/connector/oauth/local-callback
```

The command also creates GPT Actions and GPT Apps OAuth client secrets. Read those secrets from the printed Parameter Store names when configuring ChatGPT.

## Build And Run

Upload source and trigger the container build:

```sh
npm --prefix ci/cdk run build:image
```

Restart the instance service after the image build completes:

```sh
aws ssm send-command \
  --instance-ids INSTANCE_ID \
  --document-name AWS-RunShellScript \
  --parameters commands='["systemctl restart gpt-mcp-service.service"]'
```

## Teardown

Destroy the stack from the same configured environment:

```sh
npm --prefix ci/cdk run destroy
```

Parameter values, the EC2 instance, DNS record, Cognito user pool, ECR repository, source bucket, KMS key, and generated build resources are stack-owned.

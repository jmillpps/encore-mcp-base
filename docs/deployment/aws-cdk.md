# AWS CDK Deployment

The CDK deployment provisions the production service on one EC2 instance with Route53 DNS, ECR image storage, CodeBuild image builds, Caddy HTTPS termination, AWS Systems Manager Parameter Store runtime configuration, one DynamoDB state table, and a selectable upstream identity provider mode.

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
| `CDK_PARAMETER_PREFIX` | Parameter Store path for runtime configuration. |
| `CDK_INSTANCE_TYPE` | EC2 instance type. |
| `CDK_IDENTITY_PROVIDER_MODE` | Identity provider mode. Supported values are `external` and `cognito`. |

Optional deployment inputs:

| Variable | Purpose |
| --- | --- |
| `CDK_ALLOWED_ORIGINS` | Browser origins allowed by the service. Default allows ChatGPT origins. |
| `CDK_WIDGET_DOMAIN` | ChatGPT Apps widget origin. Default is the public service origin. |

`CDK_APP_NAME` and `CDK_ENVIRONMENT_NAME` form AWS resource names. `CDK_SERVICE_NAME` controls the systemd unit name, Docker container name, runtime directories, and bootstrap logs on the EC2 instance.

Store operator-specific values in an ignored local shell file, CI secret store, or secure operator runbook. Keep account IDs, hosted zone IDs, real domains, identity provider tenant IDs, client secrets, stack names, and parameter paths out of tracked source files.

## State Table

The stack creates one DynamoDB table for OAuth grants, refresh tokens, MCP sessions, and rate-limit buckets. The table uses `pk` and `sk` keys, on-demand billing, TTL on `ttl`, point-in-time recovery, customer-managed KMS encryption, deletion protection, retained data, and zero secondary indexes.

The instance role receives `DescribeTable`, `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, and `TransactWriteItems` on the table.

## External Identity Provider Inputs

Use `CDK_IDENTITY_PROVIDER_MODE=external` when an upstream provider already exists.

| Variable | Purpose |
| --- | --- |
| `CDK_UPSTREAM_OIDC_ISSUER_URL` | Upstream issuer URL. |
| `CDK_UPSTREAM_OIDC_DISCOVERY_URL` | Upstream discovery document URL. Default is the issuer plus `/.well-known/openid-configuration`. |
| `CDK_UPSTREAM_OIDC_AUTHORIZATION_URL` | Upstream authorization endpoint. |
| `CDK_UPSTREAM_OIDC_TOKEN_URL` | Upstream token endpoint. |
| `CDK_UPSTREAM_OIDC_USERINFO_URL` | Upstream userinfo endpoint. |
| `CDK_UPSTREAM_OIDC_CLIENT_ID` | Upstream OAuth client ID. |
| `CDK_UPSTREAM_OIDC_SCOPES` | Upstream scopes. Default is `openid profile email`. |
| `CDK_UPSTREAM_OIDC_TOKEN_AUTH_METHOD` | Upstream token client authentication method. Default is `client_secret_post`. |

Set `CDK_UPSTREAM_OIDC_CLIENT_SECRET` before running the parameter seed command in external mode. The seed command stores it as `UPSTREAM_OIDC_CLIENT_SECRET` in Parameter Store.

Register this callback URL in the upstream provider:

```text
https://service.example.com/oauth/callback
```

## Cognito Identity Provider Inputs

Use `CDK_IDENTITY_PROVIDER_MODE=cognito` to create a quick-start upstream provider.

| Variable | Purpose |
| --- | --- |
| `CDK_COGNITO_DOMAIN_PREFIX` | Globally unique Cognito hosted UI domain prefix. |

Cognito mode creates a user pool, app client, and hosted UI domain. The stack writes generated Cognito endpoint values into the generic `UPSTREAM_OIDC_*` runtime parameters.

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
| External upstream URLs | HTTPS URLs with public hostnames and no credentials, query strings, or fragments. |
| Widget domain | HTTPS origin with a public hostname and no path. |
| External upstream scopes | Whitespace-separated scopes containing `openid`. |
| External token auth method | `client_secret_post` or `client_secret_basic`. |

`CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION` must be explicit in the operator environment. CDK synthesis reads deployment identity from the operator environment.

## Stack Resources

The stack creates:

| Resource | Purpose |
| --- | --- |
| KMS key | Encrypt SecureString runtime parameters. |
| ECR repository | Store built service images. |
| S3 source bucket | Store the uploaded source archive for CodeBuild. |
| Optional Cognito user pool | Host quick-start upstream login in Cognito mode. |
| Optional Cognito app client | Provide the quick-start upstream OAuth client in Cognito mode. |
| Optional Cognito hosted UI domain | Serve quick-start browser login in Cognito mode. |
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

The stack writes generic upstream OIDC runtime parameters for both identity provider modes. The bootstrap process writes the signing private key to an instance-local file and sets `OAUTH_PRIVATE_KEY_PEM_FILE` for the container. The raw key stays out of source files and deployment command output.

Runtime parameter details are covered in [Runtime Parameters](runtime-parameters.md).

## Seed Runtime Parameters

After deployment, seed ChatGPT OAuth client records with ChatGPT redirect URIs:

```sh
npm --prefix ci/cdk run seed:parameters -- \
  --stack-name "$CDK_STACK_NAME" \
  --actions-client-id "$ACTIONS_CLIENT_ID" \
  --actions-redirect-uri "$ACTIONS_REDIRECT_URI" \
  --mcp-client-id "$MCP_CLIENT_ID" \
  --mcp-redirect-uri "$MCP_REDIRECT_URI"
```

The command creates GPT Actions and GPT Apps OAuth client secrets. Read those secrets from the printed Parameter Store names when configuring ChatGPT.

In Cognito identity provider mode, `npm --prefix ci/cdk run deploy` writes the generated Cognito app client secret to `UPSTREAM_OIDC_CLIENT_SECRET` as a SecureString parameter after CloudFormation completes.

In external identity provider mode, set `CDK_UPSTREAM_OIDC_CLIENT_SECRET` in the shell before running the seed command. The seed command stores that value in `UPSTREAM_OIDC_CLIENT_SECRET` as a SecureString parameter.

## Build And Run

Deploy or update the stack:

```sh
npm --prefix ci/cdk run deploy -- "$CDK_STACK_NAME"
```

The deploy command runs `cdk deploy` and then syncs generated runtime parameters owned by the selected identity provider mode.

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
  --parameters "commands=[\"systemctl restart ${CDK_SERVICE_NAME}.service\"]"
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

The stack publishes these outputs in every identity provider mode:

| Output | Purpose |
| --- | --- |
| `PublicUrl` | Public service origin. |
| `McpResourceUrl` | Public MCP resource URL. |
| `ActionsAudience` | Public Actions audience URL. |
| `ParameterPrefix` | Runtime Parameter Store path. |
| `ParameterKeyId` | KMS key ID for SecureString parameters. |
| `RepositoryUri` | ECR repository URI. |
| `SourceBucketName` | Source archive bucket. |
| `CodeBuildProjectName` | Image build project. |
| `InstanceId` | EC2 instance ID. |
| `ElasticIp` | Elastic IP address. |
| `IdentityProviderMode` | Selected identity provider mode. |
| `UpstreamOidcClientId` | Upstream OAuth client ID used by the service. |
| `UpstreamOidcRedirectUri` | Service callback URL registered with the upstream provider. |

Cognito mode also publishes:

| Output | Purpose |
| --- | --- |
| `CognitoUserPoolId` | Generated Cognito user pool ID. |
| `CognitoClientId` | Generated Cognito app client ID. |
| `CognitoHostedUiBaseUrl` | Generated Cognito hosted UI base URL. |

Identity provider setup is covered in [Identity Provider](identity-provider.md). Release checks are covered in [Release Verification](release-verification.md).

## Teardown

Destroy the stack from the same configured environment:

```sh
npm --prefix ci/cdk run destroy
```

Parameter values, the EC2 instance, DNS record, ECR repository, source bucket, KMS key, and generated build resources are stack-owned. Cognito resources are stack-owned when Cognito mode is selected.

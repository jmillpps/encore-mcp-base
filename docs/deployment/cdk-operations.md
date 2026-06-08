# CDK Operations

This guide gives the operating sequence for deploying, updating, verifying, and tearing down the AWS CDK environment.

## Operator Inputs

Set deployment inputs in the shell that runs CDK:

```sh
export CDK_APP_NAME="example-mcp-service"
export CDK_ENVIRONMENT_NAME="prod"
export CDK_SERVICE_NAME="example-mcp-service"
export CDK_STACK_NAME="ExampleMcpServiceProd"
export CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID"
export CDK_DEFAULT_REGION="$AWS_REGION"
export CDK_DOMAIN_NAME="service.example.com"
export CDK_HOSTED_ZONE_ID="$HOSTED_ZONE_ID"
export CDK_HOSTED_ZONE_NAME="example.com"
export CDK_COGNITO_DOMAIN_PREFIX="example-mcp-service-prod"
export CDK_PARAMETER_PREFIX="/example-mcp-service/prod/env"
export CDK_INSTANCE_TYPE="t4g.micro"
```

Keep these values in an ignored operator shell file, CI secret store, or deployment runbook. Keep concrete deployment values out of repository files.

## Preflight

Confirm AWS identity before deployment:

```sh
aws sts get-caller-identity
```

Install root dependencies and CDK dependencies:

```sh
npm install
npm --prefix ci/cdk install
```

Run targeted checks for the CDK package:

```sh
npm --prefix ci/cdk run typecheck
node --experimental-strip-types --test --test-concurrency=1 test/cdk/*.test.ts
```

## Synthesize And Diff

Run synthesis:

```sh
npm --prefix ci/cdk run synth
```

Run a deployment diff:

```sh
npm --prefix ci/cdk run cdk -- diff "$CDK_STACK_NAME"
```

Review resource changes before deploy. Check IAM policies, security group ingress, Parameter Store paths, Cognito settings, and removal policies.

## Deploy Or Update Infrastructure

Deploy the stack:

```sh
npm --prefix ci/cdk run deploy -- "$CDK_STACK_NAME"
```

The stack creates infrastructure and writes non-secret runtime parameters. It also creates the Cognito user pool, Cognito app client, hosted UI domain, ECR repository, source bucket, CodeBuild project, EC2 instance, Elastic IP, DNS record, KMS key, and service role.

Read stack outputs:

```sh
aws cloudformation describe-stacks \
  --stack-name "$CDK_STACK_NAME" \
  --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
  --output table
```

Use outputs as operational pointers. Keep concrete output values out of repository documentation.

## Seed Runtime Parameters

Seed ChatGPT client records and service secrets after the stack exists:

```sh
npm --prefix ci/cdk run seed:parameters -- \
  --stack-name "$CDK_STACK_NAME" \
  --actions-client-id "$ACTIONS_CLIENT_ID" \
  --actions-redirect-uri "$ACTIONS_REDIRECT_URI" \
  --mcp-client-id "$MCP_CLIENT_ID" \
  --mcp-redirect-uri "$MCP_REDIRECT_URI"
```

Repeat redirect URI flags for each ChatGPT callback URL. The seed command preserves existing signing keys and ChatGPT client secrets across repeated runs.

Read the generated ChatGPT secrets from Parameter Store when configuring ChatGPT:

```sh
aws ssm get-parameter \
  --name "$CDK_PARAMETER_PREFIX/CHATGPT_ACTIONS_CLIENT_SECRET" \
  --with-decryption \
  --query Parameter.Value \
  --output text
```

```sh
aws ssm get-parameter \
  --name "$CDK_PARAMETER_PREFIX/CHATGPT_MCP_CLIENT_SECRET" \
  --with-decryption \
  --query Parameter.Value \
  --output text
```

Treat command output as secret material.

## Build And Publish The Service Image

Commit runtime source before building. The source archive uses tracked files from `HEAD`.

```sh
npm --prefix ci/cdk run build:image -- \
  --stack-name "$CDK_STACK_NAME" \
  --image-tag "$IMAGE_TAG"
```

The command uploads a tracked-source archive to the stack source bucket and starts CodeBuild. CodeBuild builds an ARM64 Docker image and pushes it to ECR.

Poll CodeBuild until the build reaches `SUCCEEDED`:

```sh
aws codebuild batch-get-builds \
  --ids "$CODEBUILD_BUILD_ID" \
  --query 'builds[0].buildStatus' \
  --output text
```

## Restart Runtime

Restart the service after a successful image build or runtime parameter update:

```sh
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters commands='["systemctl restart SERVICE_NAME.service"]'
```

Poll command status:

```sh
aws ssm list-command-invocations \
  --command-id "$SSM_COMMAND_ID" \
  --details \
  --query 'CommandInvocations[0].Status' \
  --output text
```

The systemd unit runs the service runner. The runner pulls the configured ECR image tag and starts the service container.

## Update Flow

Use this order for service-only updates:

1. Commit the runtime source changes.
2. Run targeted checks.
3. Build and publish the image.
4. Restart the runtime service.
5. Verify public endpoints.

Use this order for infrastructure updates:

1. Run CDK typecheck and CDK tests.
2. Run CDK synthesis.
3. Review CDK diff.
4. Deploy the stack.
5. Seed runtime parameters when client or secret shape changed.
6. Build and publish the image when runtime source changed.
7. Restart the runtime service.
8. Verify public endpoints and ChatGPT flows.

## Teardown

Destroy the stack from the same configured account and region:

```sh
npm --prefix ci/cdk run destroy -- "$CDK_STACK_NAME"
```

The stack owns the EC2 instance, DNS record, Elastic IP, Cognito user pool, Cognito app client, ECR repository, source bucket, KMS key, Parameter Store values, CodeBuild project, and generated build resources.

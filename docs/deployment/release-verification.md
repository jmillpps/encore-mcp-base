# Release Verification

Run release verification after deployment, after a service image update, and after runtime parameter changes.

## Infrastructure Verification

Check stack status:

```sh
aws cloudformation describe-stacks \
  --stack-name "$CDK_STACK_NAME" \
  --query 'Stacks[0].StackStatus' \
  --output text
```

Expected status is `CREATE_COMPLETE` or `UPDATE_COMPLETE`.

Check stack outputs:

```sh
aws cloudformation describe-stacks \
  --stack-name "$CDK_STACK_NAME" \
  --query 'Stacks[0].Outputs[].OutputKey' \
  --output text
```

Required outputs include `PublicUrl`, `McpResourceUrl`, `ActionsAudience`, `ParameterPrefix`, `ParameterKeyId`, `RepositoryUri`, `SourceBucketName`, `CodeBuildProjectName`, `InstanceId`, `IdentityProviderMode`, `UpstreamOidcClientId`, and `UpstreamOidcRedirectUri`.

Cognito mode also publishes `CognitoUserPoolId`, `CognitoClientId`, and `CognitoHostedUiBaseUrl`.

## Public Endpoint Verification

Verify service health:

```sh
curl https://service.example.com/health
```

Verify OAuth discovery:

```sh
curl https://service.example.com/.well-known/openid-configuration
curl https://service.example.com/.well-known/oauth-authorization-server
```

Verify MCP protected resource metadata:

```sh
curl https://service.example.com/.well-known/oauth-protected-resource/mcp
```

Verify JWKS:

```sh
curl https://service.example.com/oauth/jwks
```

Verify the Actions schema URL:

```sh
curl https://service.example.com/actions/openapi.json
```

The schema response should contain:

| Field | Expected value |
| --- | --- |
| `openapi` | `3.1.0`. |
| `servers[0].url` | Public service origin. |
| `paths./health` | Health operation. |
| `paths./actions/profile` | Profile operation. |
| `paths./actions/session` | Session operation. |
| `components.securitySchemes.OAuth2` | Authorization code flow. |

Verify the service callback route is deployed:

```sh
curl -i https://service.example.com/oauth/callback
```

A direct callback request without upstream parameters returns an OAuth error response.

## Runtime Verification

Confirm the promoted runtime image tag:

```sh
aws ssm get-parameter \
  --name "$CDK_PARAMETER_PREFIX/IMAGE_TAG" \
  --query Parameter.Value \
  --output text
```

Check systemd service status through SSM:

```sh
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters "commands=[\"systemctl is-active ${CDK_SERVICE_NAME}.service\"]"
```

Check container status through SSM:

```sh
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters "commands=[\"docker ps --filter name=${CDK_SERVICE_NAME} --format '{{.Status}}'\"]"
```

Check the running container image through SSM:

```sh
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters "commands=[\"docker ps --filter name=${CDK_SERVICE_NAME} --format '{{.Image}}'\"]"
```

Check recent service logs through SSM when public verification fails:

```sh
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters "commands=[\"journalctl -u ${CDK_SERVICE_NAME}.service -n 80 --no-pager\"]"
```

## GPT Apps Verification

Verify the app configuration uses the public MCP URL:

```text
https://service.example.com/mcp
```

Confirm OAuth settings use the service authorization and token endpoints:

```text
https://service.example.com/oauth/authorize
https://service.example.com/oauth/token
```

Complete account linking through the configured upstream identity provider. After sign-in, refresh the app and confirm ChatGPT lists the MCP tools:

- `health.check`
- `health.status_card`
- `identity.profile`
- `identity.profile_card`
- `auth.session`

Run `health.check`, `health.status_card`, `identity.profile`, and `identity.profile_card` from a normal ChatGPT chat to verify the MCP token audience, profile claims, and inline UI resources.

## GPT Actions Verification

Import the OpenAPI schema from:

```text
https://service.example.com/actions/openapi.json
```

Configure OAuth authorization code authentication with the service authorization URL, token URL, client ID, client secret, and scopes.

Use the public privacy URL:

```text
https://service.example.com/privacy
```

Complete account linking through the configured upstream identity provider. Run the profile and session Actions. The profile action should return the upstream identity profile. The session action should return token metadata with the Actions audience.

## Failure Review

Use this order when a release check fails:

1. Check stack status.
2. Check the latest CodeBuild build status.
3. Check SSM restart command status.
4. Check systemd status.
5. Check container status.
6. Check service logs.
7. Check public health.
8. Check OAuth discovery.
9. Check OpenAPI schema.
10. Check ChatGPT account linking settings.

Keep raw tokens, OAuth codes, client secrets, upstream client secrets, and user-specific profile values out of diagnostic notes.

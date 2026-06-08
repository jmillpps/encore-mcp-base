# Runtime Parameters

Production runtime configuration lives in AWS Systems Manager Parameter Store. The CDK stack owns the parameter path and the KMS key used for SecureString values.

## Parameter Path

`CDK_PARAMETER_PREFIX` selects the Parameter Store path. Use a dedicated path for each deployment environment.

The EC2 instance role is limited to this path and its children. The role can decrypt values with the stack KMS key.

## Stack Parameters

The CDK stack writes these String parameters during deployment:

| Parameter | Source |
| --- | --- |
| `NODE_ENV` | Fixed production value. |
| `IMAGE_TAG` | Runtime image tag. |
| `PUBLIC_ISSUER_URL` | Public service origin. |
| `MCP_RESOURCE_URL` | Public MCP resource URL. |
| `ACTIONS_AUDIENCE` | Public Actions audience URL. |
| `OAUTH_STORE_PATH` | Instance-local durable store path. |
| `ALLOWED_ORIGINS` | ChatGPT browser origins. |
| `ACCESS_TOKEN_TTL_SECONDS` | Access token lifetime. |
| `ID_TOKEN_TTL_SECONDS` | ID token lifetime. |
| `AUTHORIZATION_CODE_TTL_SECONDS` | Authorization code lifetime. |
| `REFRESH_TOKEN_TTL_SECONDS` | Refresh token lifetime. |
| `RATE_LIMIT_WINDOW_SECONDS` | Durable rate-limit window. |
| `RATE_LIMIT_MAX_REQUESTS` | Durable rate-limit request limit. |
| `MCP_SSE_MAX_CONNECTIONS` | Open SSE receive stream limit. |
| `COGNITO_ENABLED` | Cognito upstream login switch. |
| `COGNITO_ISSUER_URL` | Cognito issuer URL. |
| `COGNITO_AUTHORIZATION_URL` | Cognito hosted UI authorization URL. |
| `COGNITO_TOKEN_URL` | Cognito token URL. |
| `COGNITO_USERINFO_URL` | Cognito userinfo URL. |
| `COGNITO_JWKS_URL` | Cognito JWKS URL for operational reference. |
| `COGNITO_CLIENT_ID` | Cognito app client ID. |
| `COGNITO_REDIRECT_URI` | Service Cognito callback URL. |
| `COGNITO_SCOPES` | Cognito scopes. |

## Seeded Secure Parameters

Run the seed command after deployment to write secrets and ChatGPT client records:

```sh
npm --prefix ci/cdk run seed:parameters -- \
  --actions-client-id "$ACTIONS_CLIENT_ID" \
  --actions-redirect-uri "$ACTIONS_REDIRECT_URI" \
  --mcp-client-id "$MCP_CLIENT_ID" \
  --mcp-redirect-uri "$MCP_REDIRECT_URI"
```

The command writes these SecureString parameters:

| Parameter | Purpose |
| --- | --- |
| `OAUTH_PRIVATE_KEY_PEM` | Service RSA signing key. |
| `COGNITO_CLIENT_SECRET` | Cognito app client secret. |
| `CHATGPT_ACTIONS_CLIENT_SECRET` | GPT Actions OAuth client secret. |
| `CHATGPT_MCP_CLIENT_SECRET` | GPT Apps MCP OAuth client secret. |
| `OAUTH_CLIENTS_JSON` | Service OAuth client registry with hashed client secrets. |

The command writes `OAUTH_KEY_ID` as a String parameter derived from the signing key hash.

The seed command preserves existing `OAUTH_PRIVATE_KEY_PEM`, ChatGPT client secrets, and Cognito client secret values when the parameters already exist. This preserves token signing continuity and configured ChatGPT client secrets across repeated seeding runs.

## Runtime Load

The EC2 service runner reads every parameter under `CDK_PARAMETER_PREFIX` with decryption enabled. The runner writes a container environment file under `/run/<service-name>/service.env`.

The runner writes `OAUTH_PRIVATE_KEY_PEM` into `/run/<service-name>/oauth-private-key.pem` with file mode `0400`. The container receives `OAUTH_PRIVATE_KEY_PEM_FILE` and reads the key from that file.

The durable OAuth store lives under `/var/lib/<service-name>/oauth-store.json`. The container mounts `/var/lib/<service-name>` for durable state and `/run/<service-name>` read-only for runtime secrets.

## Secret Retrieval

Read ChatGPT client secrets from Parameter Store when configuring ChatGPT:

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

Treat command output as secret material. Keep raw secrets out of repository files, shell history, logs, and documentation.

## Restart

Restart the systemd service after parameter changes:

```sh
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters commands='["systemctl restart SERVICE_NAME.service"]'
```

Use the stack `InstanceId` output and the configured `CDK_SERVICE_NAME` value.

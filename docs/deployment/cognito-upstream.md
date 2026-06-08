# Cognito Upstream Login

The CDK deployment creates Cognito as the upstream identity directory for the service OAuth provider. ChatGPT authenticates to the service. The service redirects the browser to Cognito and then issues its own OAuth tokens to ChatGPT.

## CDK Resources

The stack creates:

| Resource | Behavior |
| --- | --- |
| Cognito user pool | Email sign-in, disabled self sign-up, email account recovery, required email, required given name, required family name. |
| Cognito app client | Authorization code flow, generated client secret, Cognito identity provider, and prevent-user-existence-errors behavior. |
| Cognito hosted UI domain | Browser login origin for upstream authorization. |
| Cognito callback URL | Service callback at `https://service.example.com/oauth/cognito/callback`. |

The Cognito password policy requires at least fourteen characters, digits, lowercase letters, uppercase letters, and symbols.

## Runtime Parameters

The stack writes Cognito runtime values under `CDK_PARAMETER_PREFIX`:

| Parameter | Meaning |
| --- | --- |
| `COGNITO_ENABLED` | Enables upstream Cognito login. |
| `COGNITO_ISSUER_URL` | Cognito OIDC issuer. |
| `COGNITO_AUTHORIZATION_URL` | Hosted UI authorization endpoint. |
| `COGNITO_TOKEN_URL` | Hosted UI token endpoint. |
| `COGNITO_USERINFO_URL` | Hosted UI userinfo endpoint. |
| `COGNITO_CLIENT_ID` | Cognito app client ID. |
| `COGNITO_REDIRECT_URI` | Service callback URL. |
| `COGNITO_SCOPES` | Upstream scopes, currently `openid profile email`. |

The seed command writes `COGNITO_CLIENT_SECRET` as a SecureString parameter after reading it from Cognito.

## OAuth Flow

The production flow has these steps:

1. ChatGPT opens `/oauth/authorize` with its client ID, redirect URI, scopes, state, nonce, resource, and PKCE values.
2. The service validates the ChatGPT authorization request.
3. The service stores an upstream authorization state record.
4. The service redirects the browser to Cognito hosted login with PKCE.
5. The Cognito user signs in through the hosted UI.
6. Cognito redirects to `/oauth/cognito/callback`.
7. The service consumes the upstream state once.
8. The service exchanges the Cognito authorization code at the Cognito token endpoint.
9. The service reads Cognito userinfo.
10. The service creates its own authorization code for the original ChatGPT redirect URI.
11. ChatGPT exchanges the service authorization code at `/oauth/token`.
12. The service returns signed access, ID, and refresh tokens with the service issuer.

The service tokens use the service issuer and the requested service resource audience. Cognito remains the upstream identity proof source for the profile claims.

## Profile Claims

Cognito userinfo supplies profile values used by:

- ID tokens.
- `/oauth/userinfo`.
- MCP `identity.profile`.
- GPT Actions `GET /actions/profile`.

Users need email, given name, and family name values. The service maps those claims into the service identity profile.

## Client Secret Handling

The Cognito app client secret is read during the seed command and stored in Parameter Store as `COGNITO_CLIENT_SECRET`. The EC2 service runner loads it into the container environment file during restart.

Keep the Cognito client secret in Parameter Store and operational secret systems. Keep it out of repository files, shell history, and documentation.

## Operator Checks

Verify Cognito discovery values through the service configuration by checking OAuth discovery:

```sh
curl https://service.example.com/.well-known/openid-configuration
```

Verify the service callback path is reachable after deployment:

```sh
curl -I https://service.example.com/oauth/cognito/callback
```

A direct callback request without Cognito parameters should return an OAuth error response. The check proves the route is served by the deployment.

## User Management

Create users in the deployed Cognito user pool through AWS Console, AWS CLI, or an operator workflow. Assign required profile attributes during user creation or before the first login.

Keep user-specific emails and identities out of repository documentation.

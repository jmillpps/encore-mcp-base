# Identity Provider

The service uses an upstream OIDC or OAuth identity provider for browser sign-in. ChatGPT authenticates to the service. The service redirects the browser to the upstream provider, verifies the upstream identity, and issues service-owned OAuth tokens to ChatGPT.

## Provider Requirements

Register one confidential authorization-code client with the upstream provider.

| Setting | Value |
| --- | --- |
| Callback URL | `https://service.example.com/oauth/callback` |
| Scopes | `openid profile email` |
| Client authentication | `client_secret_post` or `client_secret_basic` |
| PKCE | Supported for authorization requests |
| Discovery | OIDC discovery document with `jwks_uri` and ID token signing algorithms |

The upstream provider must expose issuer, discovery, authorization, token, userinfo, and JWKS endpoints over public HTTPS URLs.

## Runtime Parameters

Runtime configuration uses generic upstream OIDC parameter names:

| Parameter | Meaning |
| --- | --- |
| `UPSTREAM_OIDC_ISSUER_URL` | Upstream issuer URL. |
| `UPSTREAM_OIDC_DISCOVERY_URL` | Upstream discovery document URL. |
| `UPSTREAM_OIDC_AUTHORIZATION_URL` | Upstream authorization endpoint. |
| `UPSTREAM_OIDC_TOKEN_URL` | Upstream token endpoint. |
| `UPSTREAM_OIDC_USERINFO_URL` | Upstream userinfo endpoint. |
| `UPSTREAM_OIDC_CLIENT_ID` | Upstream OAuth client ID. |
| `UPSTREAM_OIDC_REDIRECT_URI` | Service callback URL. |
| `UPSTREAM_OIDC_SCOPES` | Upstream scopes. |
| `UPSTREAM_OIDC_TOKEN_AUTH_METHOD` | Upstream token client authentication method. |

Store `UPSTREAM_OIDC_CLIENT_SECRET` as a secret value in Parameter Store or the deployment secret manager.

## OAuth Flow

The production flow has these steps:

1. ChatGPT opens `/oauth/authorize` with its client ID, redirect URI, scopes, state, nonce, resource, and PKCE values.
2. The service validates the ChatGPT authorization request.
3. The service stores an upstream authorization state record.
4. The service redirects the browser to the upstream provider with PKCE and a service-generated nonce.
5. The user signs in through the upstream provider.
6. The upstream provider redirects to `/oauth/callback`.
7. The service consumes the upstream state once.
8. The service reads upstream discovery metadata and JWKS.
9. The service exchanges the upstream authorization code at the upstream token endpoint.
10. The service validates the upstream ID token signature, issuer, audience, expiration, issued-at time, nonce, and access-token hash when present.
11. The service reads upstream userinfo and verifies its subject against the ID token subject.
12. The service creates its own authorization code for the original ChatGPT redirect URI.
13. ChatGPT exchanges the service authorization code at `/oauth/token`.
14. The service returns signed access, ID, and refresh tokens with the service issuer.

The service tokens use the service issuer and the requested service resource audience.

## Profile Claims

Userinfo must supply these claims:

| Claim | Rule |
| --- | --- |
| `sub` | Stable subject for the authenticated user. |
| `email` | Email address for the authenticated user. |
| `email_verified` | Boolean email verification claim. |

Optional display claims are `given_name`, `family_name`, `name`, and `preferred_username`. The service derives missing display values from available name and email values.

The verified profile is used by:

- ID tokens.
- `/oauth/userinfo`.
- MCP `identity.profile`.
- GPT Actions `GET /actions/profile`.

## CDK External Provider Mode

Set `CDK_IDENTITY_PROVIDER_MODE=external` when an upstream provider already exists. Supply the upstream endpoint and client values through `CDK_UPSTREAM_OIDC_*` deployment inputs. Supply `CDK_UPSTREAM_OIDC_CLIENT_SECRET` when running the parameter seed command.

External mode creates service infrastructure and writes generic upstream OIDC runtime parameters. It creates no identity directory.

## CDK Cognito Provider Mode

Set `CDK_IDENTITY_PROVIDER_MODE=cognito` to let CDK create a quick-start upstream provider. The stack creates a Cognito user pool, app client, and hosted UI domain, then writes the generated Cognito endpoints into the same generic upstream OIDC runtime parameters.

Cognito mode uses the service callback URL at `/oauth/callback`. The CDK deploy command reads the generated Cognito app client secret after CloudFormation completes and stores it as `UPSTREAM_OIDC_CLIENT_SECRET`.

Create users in the deployed Cognito user pool through AWS Console, AWS CLI, or an operator workflow. Assign required profile attributes before the first login.

## Operator Checks

Verify OAuth discovery after deployment:

```sh
curl https://service.example.com/.well-known/openid-configuration
```

Verify the service callback route is deployed:

```sh
curl -i https://service.example.com/oauth/callback
```

A direct callback request without upstream parameters returns an OAuth error response. The check proves the route is served by the deployment.

Keep user-specific emails, provider tenant IDs, client secrets, account IDs, hosted zone IDs, and real domains out of repository documentation.

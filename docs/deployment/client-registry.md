# Client Registry

Production clients are configured through `OAUTH_CLIENTS_JSON`. Each record declares redirect URIs, scopes, resource audiences, token endpoint authentication, PKCE policy, and client class.

## Record Fields

| Field | Type | Rule |
| --- | --- | --- |
| `clientId` | string | Identifier using letters, numbers, `.`, `_`, `:`, or `-`. Must be unique. |
| `clientSecretHash` | string | SHA-256 base64url hash with 43 characters. |
| `displayName` | string | Safe human-readable client name. |
| `redirectUris` | string[] | Exact callback URLs accepted during authorization. Must be unique. |
| `allowedScopes` | string[] | Scopes the client may request. Must be unique. |
| `allowedResources` | string[] | Token audiences the client may request. Must be unique. |
| `tokenEndpointAuthMethod` | string | `client_secret_post` or `client_secret_basic` for static registry clients. |
| `pkcePolicy` | string | `required` or `optional`. Production clients use `required`. |
| `clientClass` | string | Service policy class for resource default behavior. |

`OAUTH_CLIENTS_JSON` must be a non-empty JSON array. Records reject unsupported fields, empty strings, duplicate values, malformed URLs, wildcard URLs, credential-bearing URLs, and fragment-bearing resource URLs.

## GPT Actions Client

Actions clients usually use `client_secret_post`, `pkcePolicy` value `required`, `clientClass` value `gpt-actions`, and one Actions audience in `allowedResources`.

Actions clients may omit `resource` during authorization, token exchange, and refresh when exactly one allowed resource is configured.

## GPT Apps MCP Client

GPT Apps MCP clients use the MCP resource in `allowedResources`. MCP token flows include `resource`. The local GPT Apps client requires PKCE.

## Secret Generation

Generate a secret and hash:

```sh
node --experimental-strip-types tools/generate-client-secret.ts
```

Store the raw secret in the GPT OAuth configuration. Store only the hash in `OAUTH_CLIENTS_JSON`.

## Production Review

Before deployment, review each record:

1. Confirm every redirect URI belongs to the expected GPT product callback.
2. Confirm scopes match the specific GPT behavior.
3. Confirm resources contain the intended Actions audience or MCP resource.
4. Confirm PKCE is required.
5. Confirm raw secrets appear only in the GPT configuration and the secret manager.

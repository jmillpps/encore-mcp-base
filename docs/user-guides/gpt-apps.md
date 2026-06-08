# GPT Apps Setup

GPT Apps use MCP. This service exposes MCP through Streamable HTTP at `/mcp` and supports legacy HTTP/SSE at `/sse` and `/messages`.

Start the local service before configuring ChatGPT:

```sh
npm run dev
```

## Local Setup Values

Use these values for local development:

| Field | Value |
| --- | --- |
| MCP URL | `http://localhost:4000/mcp` |
| OAuth authorization URL | `http://localhost:4000/oauth/authorize` |
| OAuth token URL | `http://localhost:4000/oauth/token` |
| Client ID | `gpt-apps-mcp` |
| Client secret | `gpt-apps-secret` |
| Scopes | `openid profile email` |

The local GPT Apps client allows these callback URLs:

- `https://chatgpt.com/connector/oauth/local-callback`
- `https://chatgpt.com/connector_platform_oauth_redirect`

## Preflight Checks

Verify the service and metadata before opening the GPT configuration:

```sh
curl http://localhost:4000/health
curl http://localhost:4000/.well-known/oauth-protected-resource/mcp
```

The protected resource response includes `resource`, `authorization_servers`, `scopes_supported`, and `bearer_methods_supported`.

## Expected OAuth Flow

GPT Apps starts authorization with `response_type=code`, the MCP resource, scopes, and PKCE. The token exchange returns an MCP-audience access token. The service requires that token for every `/mcp`, `/sse`, and `/messages` request.

MCP protected tools return `WWW-Authenticate` and `mcp/www_authenticate` challenges when the token is missing, invalid, or missing scopes.

## MCP Tools

Current tools:

| Tool | Scopes | Purpose |
| --- | --- | --- |
| `health.check` | none | Confirm service reachability. |
| `identity.profile` | `openid profile email` | Return the authenticated OIDC user profile. |
| `auth.session` | `openid` | Return token subject, client ID, audience, and scopes. |

Tool descriptors include input schemas, output schemas, annotations, security schemes, invocation status text, and ChatGPT metadata.

## ChatGPT Configuration Steps

Use these values in the GPT Apps MCP setup:

1. Set the MCP URL to `http://localhost:4000/mcp`.
2. Set OAuth authorization URL to `http://localhost:4000/oauth/authorize`.
3. Set OAuth token URL to `http://localhost:4000/oauth/token`.
4. Set client ID to `gpt-apps-mcp`.
5. Set client secret to `gpt-apps-secret`.
6. Set scopes to `openid profile email`.
7. Save the connector and start account linking.

After account linking, ChatGPT initializes the MCP session and requests the tool list. The service returns `health.check`, `identity.profile`, and `auth.session`.

## Transport Behavior

Streamable HTTP uses:

- `POST /mcp` for JSON-RPC requests, notifications, and client responses.
- `GET /mcp` for the SSE receive stream.
- `DELETE /mcp` for session termination.

The service uses protocol baseline `2025-11-25`. Initialize returns `MCP-Session-Id`. Later session requests send `MCP-Session-Id` and may send `MCP-Protocol-Version`.

The SSE receive stream stays open for later server-originated messages and heartbeats. `MCP_SSE_MAX_CONNECTIONS` bounds open receive streams.

## Troubleshooting

Use these checks when account linking or MCP initialization fails:

| Symptom | Check |
| --- | --- |
| OAuth redirect rejected | Confirm the callback URL exists in the client record. |
| Token rejected by `/mcp` | Confirm the token audience equals `MCP_RESOURCE_URL`. |
| Scope challenge returned | Confirm requested scopes include the tool scopes. |
| SSE closes early | Check proxy streaming timeouts and `MCP_SSE_MAX_CONNECTIONS`. |
| Tool result rejected | Check the tool output schema in the MCP API reference. |

## Developer Verification

Use [Local End-To-End Scenarios](local-end-to-end.md) for local OAuth and MCP proof. Use [MCP Tool Development](../development/mcp-tool-development.md) when changing tool descriptors, scopes, schemas, or output shape.

## Production Setup

Production GPT Apps setup needs a public HTTPS service URL and OAuth discovery metadata. Use [Production Deployment](../deployment/production.md), [Client Registry](../deployment/client-registry.md), and [Configuration Reference](../api/configuration.md) for required environment variables.

Create the custom app from ChatGPT Settings:

1. Open `Settings`.
2. Open `Apps`.
3. Select `Create app`.
4. Set the app name and description.
5. Set the MCP server URL to the public `/mcp` URL.
6. Keep OAuth authentication enabled.
7. Review advanced OAuth settings.
8. Use the ChatGPT-generated Client Identifier Metadata Document setting when the form selects it.
9. Acknowledge the custom MCP server warning.
10. Create the app.
11. Sign in with the app.
12. Refresh the app after sign-in so ChatGPT reloads the MCP tool list.

After refresh, ChatGPT should list `health.check`, `identity.profile`, and `auth.session` in the app actions section.

Validate connected app tools in the ChatGPT chat surface that lists the app after account linking and refresh.

## Identity Provider Sign-In

Production GPT Apps authentication redirects through the service OAuth endpoint to the configured upstream identity provider. Sign in with the upstream provider account. After the provider returns to `/oauth/callback`, the service issues the GPT Apps authorization code and ChatGPT exchanges it for an MCP-audience access token.

## Client Metadata

ChatGPT can present a Client Identifier Metadata Document URL and callback URL during app setup. Keep the registration URL empty when ChatGPT has no registration URL value. Add the ChatGPT callback URL to the configured client record when using a static registry client. Use [Client Metadata Maintenance](../maintenance/client-metadata.md) for metadata-document client behavior.

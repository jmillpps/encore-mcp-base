# GPT MCP Service

GPT MCP Service is a TypeScript Encore service that exposes one private OAuth-backed integration surface for ChatGPT. It supports GPT Apps through MCP Streamable HTTP and legacy HTTP/SSE, and it supports GPT Actions through REST endpoints described by OpenAPI 3.1.

The service is built for private GPT integrations that need stable authentication, scoped user profile access, and a small maintainable capability surface. The current identity profile is a static OpenID Connect user. The OAuth provider, token storage, MCP transports, Actions endpoints, OpenAPI export, diagnostics, rate limits, and production configuration checks are implemented in this repository.

The repository is useful for GPT builders, operators, and maintainers who need one secure service boundary for Apps and Actions.

For the full documentation map, start at [docs/index.md](docs/index.md). Use [Local Development](docs/user-guides/local-development.md) to run the service, [GPT Apps Setup](docs/user-guides/gpt-apps.md) to connect MCP, and [GPT Actions Setup](docs/user-guides/gpt-actions.md) to import the Actions schema. The architecture overview lives in [docs/architecture/overview.md](docs/architecture/overview.md). Production setup lives in [docs/deployment/production.md](docs/deployment/production.md).

## Install And Run

Install Node.js, npm, and the Encore CLI. Then run:

```sh
npm install
npm run dev
curl http://localhost:4000/health
node --experimental-strip-types tools/export-openapi.ts --base-url http://localhost:4000 --out var/actions.openapi.json
```

The local service starts with development clients, local URLs, generated signing keys, and the default OAuth store path at `var/oauth-store.json`. Local defaults are for development and automated tests.

## What It Exposes

GPT Apps use MCP at `/mcp`. The service also exposes legacy `/sse` and `/messages` endpoints for clients that still need HTTP/SSE transport support. MCP details are in [docs/api/mcp.md](docs/api/mcp.md).

GPT Actions use `/actions/profile`, `/actions/session`, `/actions/openapi.json`, and `/health`. Actions details are in [docs/api/actions.md](docs/api/actions.md).

OAuth and OIDC use `/oauth/authorize`, `/oauth/token`, `/oauth/userinfo`, `/oauth/jwks`, and discovery metadata. OAuth details are in [docs/api/oauth.md](docs/api/oauth.md).

Developers adding new capabilities should implement shared behavior once, then expose it through MCP and Actions adapters. The development workflow is in [docs/development/adding-capabilities.md](docs/development/adding-capabilities.md).

# Architecture

The service uses Encore TypeScript for public HTTP endpoints, raw HTTP endpoints, and generated OpenAPI output.

Runtime code is split by service boundary. OAuth code lives under `auth/`. MCP code lives under `mcp/`. GPT Actions code lives under `actions/`. Shared primitives live under `shared/`.

Code files contain implementation. Documentation files contain explanation, operation, and decisions.

Each code module owns one behavior. Each documentation file owns one topic.

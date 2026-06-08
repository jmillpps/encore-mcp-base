# Project Structure

The repository keeps implementation, documentation, tooling, and tests in separate roots.

| Path | Purpose |
| --- | --- |
| `actions/` | GPT Actions REST endpoint adapters. |
| `auth/` | OAuth provider, OIDC, token issuance, clients, scopes, and durable auth state. |
| `mcp/` | MCP protocol, transports, tools, sessions, descriptors, and result validation. |
| `shared/` | Shared runtime primitives with no imports from feature roots. |
| `ci/cdk/` | AWS CDK deployment, parameter seeding, source packaging, and deployment tests. |
| `tools/` | Local operator commands and repository checks. |
| `test/` | Live service tests and module tests. |
| `docs/` | Project documentation. |

## Dependency Boundaries

`shared/` is the lowest-level runtime root. `auth/` may use `shared/`. `actions/` and `mcp/` may use `auth/` and `shared/`. Runtime code imports from runtime roots.

| Root | Import boundary |
| --- | --- |
| `shared/` | Node standard library and type-only local primitives. |
| `auth/` | `shared/` plus focused auth submodules. |
| `mcp/` | `auth/`, `shared/`, and focused MCP submodules. |
| `actions/` | `auth/`, `shared/`, and focused Actions submodules. |
| `tools/` | Runtime modules and Node standard library for local verification. |
| `test/` | Runtime modules and support harnesses needed for live behavior tests. |

## File Scope

Files stay focused on one behavior. Protocol adapters stay thin. Shared capability behavior belongs in focused modules that can be reused by MCP and Actions surfaces.

## Developer Edit Workflow

Use this order before editing:

1. Identify the public surface: OAuth, MCP, Actions, deployment, tooling, or tests.
2. Read the endpoint or adapter file for that surface.
3. Read the shared module that owns the behavior.
4. Read the matching API or architecture doc.
5. Select the narrow test file that proves the behavior.
6. Make the smallest coherent feature slice.

## Placement Rules

| Change | Placement |
| --- | --- |
| OAuth request parsing | `auth/endpoints.*.ts` |
| OAuth grant, client, token, scope, and upstream behavior | Focused modules under `auth/` |
| Durable OAuth state | `auth/storage/` |
| MCP transport behavior | `mcp/endpoints.*.ts` and focused transport modules under `mcp/` |
| MCP tool adapter | `mcp/tools/` plus `mcp/tool-registry.ts` |
| Actions route adapter | `actions/endpoints.*.ts` |
| Actions bearer validation | `actions/action-bearer.ts` |
| OpenAPI schema generation | `actions/openapi-document.ts` and `tools/export-openapi.ts` |
| Cross-surface runtime primitive | `shared/` |
| Test harness helper | `test/support/` |
| Surface test | `test/oauth/`, `test/mcp/`, `test/actions/`, `test/security/`, or `test/config/` |
| Deployment infrastructure | `ci/cdk/` |
| Durable explanation | `docs/` |

## File Size

Keep a file centered on one job. Split a file when it starts owning several validation paths, transport paths, or output formats. Prefer clear names and small functions over explanatory code comments.

## Generated And Local Files

| File class | Rule |
| --- | --- |
| Encore generated files | Treat as generated runtime support. Edit source files that produce behavior. |
| OpenAPI artifacts under `var/` | Generated local outputs stay out of the repository unless a release process explicitly requires them. |
| Planning files | `AGENTS.md`, `PRD.md`, and operator notes stay local and untracked. |
| Documentation | Repository documentation belongs under `docs/`, with the root `README.md` as the public entrypoint. |
| Tests | Test files stay under `test/` and target live behavior or focused runtime modules. |

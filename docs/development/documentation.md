# Documentation Standards

Documentation lives under `docs/` except the root `README.md`. Planning files such as `AGENTS.md` and `PRD.md` stay local and untracked.

## Structure

Use the top-level documentation families:

- `api/`
- `architecture/`
- `deployment/`
- `development/`
- `maintenance/`
- `reference/`
- `user-guides/`

Create focused files by domain. Split a wide domain into a folder and child documents when one file becomes hard to scan.

## Source References

Use [External References](../reference/external-references.md) for authoritative external specifications and official platform documentation. Add a source when a document depends on ChatGPT Apps behavior, GPT Actions behavior, MCP protocol rules, OAuth, OIDC, OpenAPI, JSON Schema, Encore runtime behavior, AWS CDK, Parameter Store, KMS, or Caddy behavior.

Keep source links near the documentation family that uses them. Use the central reference page for cross-project source mapping and individual docs for task-specific links.

## Writing

Write direct, plain sentences. Keep paragraphs short. Use tables, lists, and code blocks when they make information easier to find.

Avoid function-level and class-level module narration. Document stable service behavior, protocol contracts, operational rules, and development workflows.

Use generic examples for operator-specific values. Prefer placeholders such as `service.example.com`, `CDK_STACK_NAME`, `CDK_PARAMETER_PREFIX`, and shell variables. Keep personal domains, personal email addresses, AWS account IDs, hosted zone IDs, AWS resource IDs, usernames, and private deployment values out of documentation.

## Depth

Each documentation file should answer the questions owned by its title. A strong page identifies the reader, the scope, the inputs, the outputs, the steps, the security rules, the verification evidence, the failure modes, and the related docs. Use diagrams when a sequence or trust boundary is easier to understand visually. Use tables when readers need to compare fields, endpoints, variables, commands, or responsibilities.

## Review

Review documentation by reading it directly. Keep tests and scripts out of documentation wording, tone, and clarity review.

Use this manual review path:

1. Read the page title and confirm the page owns that subject.
2. Read each heading and confirm the order matches the reader workflow.
3. Read every sentence for directness, precision, and necessity.
4. Confirm examples use generic placeholders.
5. Confirm links point to the owning docs or authoritative external references.
6. Confirm code files and documentation files stay separate.
7. Confirm runtime tests remain tied to service behavior and never to documentation wording.

## Modular Coverage

| Documentation type | Required coverage |
| --- | --- |
| API docs | Endpoints, auth, request shape, response shape, errors, status codes, scopes, and generated schemas. |
| Architecture docs | Boundaries, trust model, storage model, protocol flow, dependency direction, and extension pattern. |
| Deployment docs | Inputs, parameters, commands, resource ownership, secret placement, verification, and rollback. |
| Development docs | File ownership, workflow, tests, security review, docs rules, and commit readiness. |
| Maintenance docs | Operational task, safe handling, evidence, recovery steps, and failure interpretation. |
| User guides | Setup values, step order, verification, troubleshooting, and production handoff. |

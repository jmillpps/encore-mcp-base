# Documentation Standards

Documentation lives under `docs/` except the root `README.md`. Planning files such as `AGENTS.md` and `PRD.md` stay local and untracked.

## Structure

Use the top-level documentation families:

- `api/`
- `architecture/`
- `deployment/`
- `development/`
- `maintenance/`
- `user-guides/`

Create focused files by domain. Split a wide domain into a folder and child documents when one file becomes hard to scan.

## Writing

Write direct, plain sentences. Keep paragraphs short. Use tables, lists, and code blocks when they make information easier to find.

Avoid function-level and class-level module narration. Document stable service behavior, protocol contracts, operational rules, and development workflows.

Use generic examples for operator-specific values. Prefer placeholders such as `service.example.com`, `CDK_STACK_NAME`, `CDK_PARAMETER_PREFIX`, and shell variables. Keep personal domains, personal email addresses, AWS account IDs, hosted zone IDs, AWS resource IDs, usernames, and private deployment values out of documentation.

## Review

Review documentation by reading it directly. Keep tests and scripts out of documentation wording, tone, and clarity review.

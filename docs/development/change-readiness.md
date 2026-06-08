# Change Readiness

Use this guide before committing, building, or releasing a developer-owned change.

## Feature Slice

Keep each feature slice coherent:

- One behavior change.
- One focused refactor.
- One test addition.
- One documentation update.
- One deployment update.

Finish and commit the current slice before starting another slice.

## Worktree Checks

Run these checks during development:

```sh
git status --short
git diff --check
```

Run `git status --short` before editing, before committing, and after committing. Preserve unrelated local changes.

## Targeted Verification

Run the narrow check for the changed surface:

| Changed area | Check |
| --- | --- |
| TypeScript types | `npm run typecheck` |
| OAuth | Affected `test/oauth/*.test.ts` files |
| MCP | Affected `test/mcp/*.test.ts` files |
| Actions | Affected `test/actions/*.test.ts` files |
| Security | Affected `test/security/*.test.ts` files and the owning surface test |
| CDK | `npm --prefix ci/cdk test` |
| Repository structure | `npm run check:dependencies`, `npm run check:architecture`, `npm run check:file-scope`, and `npm run check:test-placement` |

Run the full gate before release:

```sh
npm run check
```

## Documentation Updates

Update `docs/` when a change affects public behavior, protocol behavior, operational behavior, security posture, configuration, testing, or developer workflow.

Review prose by reading it directly. Keep tests tied to live service behavior.

## Commit Readiness

Commit after the slice is complete and the targeted check passes.

Use a direct message that names the completed behavior:

```sh
git commit -m "Add scoped profile action"
```

## Release Readiness

Before release, verify:

- Worktree is clean.
- Source changes are committed.
- Full gate passes.
- OpenAPI output matches the current service behavior.
- Runtime parameter docs match deployment inputs.
- Security review questions are answered.
- Release verification steps are selected.

Source archives use tracked files from committed `HEAD`. Build images from committed source so the runtime image can be traced to a Git revision.

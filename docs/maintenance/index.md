# Maintenance

This section contains operational procedures for a running service. Use these pages when changing runtime secrets, diagnosing production behavior, rotating signing keys, handling durable state, or reviewing remote client metadata risk.

## Maintenance Guide Selection

| Operational task | Guide | Required outcome |
| --- | --- | --- |
| Rotate token signing keys | [Signing Key Rotation](key-rotation.md) | New active key, previous public key continuity, JWKS verification, rollback path. |
| Inspect or recover durable OAuth state | [Storage Maintenance](storage.md) | Safe store handling, lock awareness, backup, restore, and permission verification. |
| Review ChatGPT metadata-document clients | [Client Metadata Maintenance](client-metadata.md) | Safe fetch, cache, redirect URI validation, JWKS validation, and private key JWT handling. |
| Troubleshoot auth, rate limits, or logs | [Diagnostics And Rate Limits](diagnostics-rate-limits.md) | Client-safe error review, redacted diagnostics, rate-limit bucket inspection, and retry guidance. |

## Operating Rules

- Treat runtime store files, signing keys, refresh tokens, OAuth client secrets, upstream client secrets, and Parameter Store values as sensitive.
- Use production read commands that reveal only the field needed for the operation.
- Capture verification evidence from public endpoints, CloudFormation outputs, Parameter Store names, service logs, and targeted service tests.
- Preserve audience separation between MCP and Actions while troubleshooting tokens.
- Use [External References](../reference/external-references.md) when a maintenance operation depends on MCP authorization, OAuth metadata, OpenID Connect discovery, AWS Parameter Store, or KMS behavior.

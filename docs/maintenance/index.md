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

- Treat DynamoDB state, local runtime store files, signing keys, refresh tokens, OAuth client secrets, upstream client secrets, and Parameter Store values as sensitive.
- Use production read commands that reveal only the field needed for the operation.
- Capture verification evidence from public endpoints, CloudFormation outputs, Parameter Store names, service logs, and targeted service tests.
- Preserve audience separation between MCP and Actions while troubleshooting tokens.
- Use [External References](../reference/external-references.md) when a maintenance operation depends on MCP authorization, OAuth metadata, OpenID Connect discovery, AWS Parameter Store, or KMS behavior.

## Maintenance Evidence

| Operation | Evidence to capture |
| --- | --- |
| Key rotation | Active `kid`, JWKS response, previous key presence, token verification, rollback material location. |
| Store restore | Store file owner-only mode, parent directory mode, service restart, refresh-token proof, new MCP session proof. |
| Metadata client review | Client metadata URL, resolved redirect URI, token auth method, JWKS URI when present, cache lifetime, failure reason. |
| Rate-limit investigation | Endpoint, subject class, bucket, configured window, configured max requests, retry pattern. |
| Production incident | Public endpoint result, relevant redacted diagnostic event, current deployment version, affected audience, affected client class. |

## Escalation Boundaries

| Condition | Action |
| --- | --- |
| Private key exposure | Rotate signing keys, revoke exposed secret material, redeploy, verify JWKS, review logs for token misuse. |
| Refresh token family replay | Confirm replay through durable store state, revoke the affected family, require account relink for the affected client. |
| Store file corruption | Stop writers, preserve a copy for analysis, restore the latest known-good backup, verify OAuth and MCP flows. |
| Metadata document compromise | Remove or pin the affected client, clear metadata cache through restart, require a trusted client record. |
| Repeated wrong-audience tokens | Check ChatGPT configuration, OAuth resource handling, client allowed resources, and Actions or MCP setup values. |

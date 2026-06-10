# Storage Maintenance

The OAuth store is a security boundary. It contains grant state, upstream login state, refresh token metadata, MCP session metadata, and rate-limit counters.

## File Protection

The service creates parent directories with mode `0700` and store files with mode `0600`. Existing store files must be regular owner-only files.

The reader rejects symlinks, malformed JSON, unexpected record shapes, and files readable by group or other accounts.

## Secret Handling

Authorization codes, upstream login states, refresh tokens, and MCP session IDs are stored as SHA-256 hashes. Raw client secrets are stored outside the JSON registry. `OAUTH_CLIENTS_JSON` stores only client secret hashes.

## Record Review

| Record group | Safe operator review |
| --- | --- |
| Authorization codes | Count active records and expiration times. Avoid copying hashes into tickets. |
| Upstream authorization states | Count pending states and expiration times during login-loop investigation. |
| Refresh tokens | Review family IDs, creation times, expiration times, rotation parents, and revoked times. |
| MCP sessions | Review count, protocol version, created time, last-seen time, initialized time, and terminated time. |
| Rate-limit buckets | Review count and reset time for the affected endpoint subject. |

## Concurrent Updates

Each update runs as a read-modify-write transaction. Updates for the same path use an in-process queue and a filesystem lock. Writes use a temporary file, fsync the temporary file, rename it into place, and fsync the containing directory.

The lock file contains a random owner token, process ID, hostname, creation time, and stale time. The lock wait times out after five seconds. Expired lock metadata is recovered automatically during acquisition.

Safe stale-lock handling:

1. Stop every service process that can write the store.
2. Confirm no writer process holds the store path or lock path.
3. Copy the store and lock file for incident evidence when available.
4. Remove only the lock file for the configured store path.
5. Start one service process and verify a write path.

## Backup And Restore

Back up the store with file permissions preserved. A backup contains active OAuth grant state, upstream login state, refresh token families, MCP session metadata, and rate-limit counters.

Restore steps:

1. Stop every service process that writes to the store.
2. Place the restored JSON file at `OAUTH_STORE_PATH`.
3. Set mode `0600` on the store file.
4. Set mode `0700` on the parent directory.
5. Start one service process and verify OAuth token refresh plus MCP session creation.

Restore a signing key backup with the matching store when active refresh tokens must remain usable across a recovery event.

## Verification After Restore

| Check | Expected result |
| --- | --- |
| Store read | Service starts and emits no malformed-store error. |
| OAuth discovery | `/.well-known/openid-configuration` returns the current issuer and JWKS URL. |
| Refresh flow | A valid refresh token from the restored store rotates successfully. |
| MCP initialize | `POST /mcp` initialize creates a new session and returns `MCP-Session-Id`. |
| Rate limit state | Existing counters either continue until reset or expire according to their stored reset time. |

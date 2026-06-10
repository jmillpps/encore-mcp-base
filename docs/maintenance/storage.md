# Storage Maintenance

The OAuth store is a security boundary. It contains grant state, upstream login state, refresh token metadata, MCP session metadata, rate-limit counters, and production metadata cache entries. Production stores this state in DynamoDB. Local development stores this state in a JSON file.

## Production Protection

DynamoDB production state uses one table with TTL, point-in-time recovery, customer-managed KMS encryption, deletion protection, retained data, and primary-key access patterns. The EC2 role receives only direct item and transaction permissions for the table.

## Local File Protection

The local file store creates parent directories with mode `0700` and store files with mode `0600`. Existing store files must be regular owner-only files.

The local file reader rejects symlinks, malformed JSON, unexpected record shapes, and files readable by group or other accounts.

## Secret Handling

Authorization codes, upstream login states, refresh tokens, MCP session IDs, MCP request IDs, rate-limit subjects, and metadata cache keys are stored as SHA-256 hashes. Raw client secrets, upstream client secrets, signing keys, and raw bearer material are stored outside the OAuth store. `OAUTH_CLIENTS_JSON` stores only client secret hashes.

## Record Review

| Record group | Safe operator review |
| --- | --- |
| Authorization codes | Count active records and expiration times. Avoid copying hashes into tickets. |
| Upstream authorization states | Count pending states and expiration times during login-loop investigation. |
| Refresh tokens | Review family IDs, creation times, expiration times, rotation parents, and revoked times. |
| MCP sessions | Review count, protocol version, created time, last-seen time, initialized time, and terminated time. |
| Rate-limit buckets | Review count and reset time for the affected endpoint subject. |
| Metadata cache entries | Review namespace, expiration time, and item count. Avoid copying full response bodies into tickets. |

## Local File Concurrent Updates

Each update runs as a read-modify-write transaction. Updates for the same path use an in-process queue and a filesystem lock. Writes use a temporary file, fsync the temporary file, rename it into place, and fsync the containing directory.

The lock file contains a random owner token, process ID, hostname, creation time, and stale time. The lock wait times out after five seconds. Expired lock metadata is recovered automatically during acquisition.

Safe stale-lock handling:

1. Stop every service process that can write the store.
2. Confirm no writer process holds the store path or lock path.
3. Copy the store and lock file for incident evidence when available.
4. Remove only the lock file for the configured store path.
5. Start one service process and verify a write path.

## Production Backup And Restore

DynamoDB point-in-time recovery supports recovery of the production state table. Restore the table to a new table name, update `OAUTH_DYNAMODB_TABLE_NAME`, restart the service, and verify OAuth token refresh plus MCP session creation.

Restore a signing key backup with the matching state table when active refresh tokens must remain usable across a recovery event.

## Local Backup And Restore

Back up the local store with file permissions preserved. A backup contains active OAuth grant state, upstream login state, refresh token families, MCP session metadata, and rate-limit counters.

Restore steps:

1. Stop every service process that writes to the store.
2. Place the restored JSON file at `OAUTH_STORE_PATH`.
3. Set mode `0600` on the store file.
4. Set mode `0700` on the parent directory.
5. Start one service process and verify OAuth token refresh plus MCP session creation.

Restore a signing key backup with the matching local store when active refresh tokens must remain usable across a recovery event.

## Verification After Restore

| Check | Expected result |
| --- | --- |
| Store read | Service starts and emits no malformed-store error. |
| OAuth discovery | `/.well-known/openid-configuration` returns the current issuer and JWKS URL. |
| Refresh flow | A valid refresh token from the restored store rotates successfully. |
| MCP initialize | `POST /mcp` initialize creates a new session and returns `MCP-Session-Id`. |
| Rate limit state | Existing counters either continue until reset or expire according to their stored reset time. |
| Metadata cache state | Client metadata and JWKS cache entries either read successfully or expire through TTL. |

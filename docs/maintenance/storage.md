# Storage Maintenance

The OAuth store is a security boundary. It contains grant state, upstream login state, refresh token metadata, MCP session metadata, and rate-limit counters.

## File Protection

The service creates parent directories with mode `0700` and store files with mode `0600`. Existing store files must be regular files with mode `0600`.

The reader rejects symlinks, malformed JSON, unexpected record shapes, and files readable by group or other accounts.

## Secret Handling

Authorization codes, upstream login states, refresh tokens, and MCP session IDs are stored as SHA-256 hashes. Raw client secrets are stored outside the JSON registry. `OAUTH_CLIENTS_JSON` stores only client secret hashes.

## Concurrent Updates

Each update runs as a read-modify-write transaction. Updates for the same path use an in-process queue and a filesystem lock. Writes use a temporary file and atomic rename.

The lock wait times out after five seconds. Operators may remove a leftover lock file after confirming every writer process is stopped.

## Backup And Restore

Back up the store with file permissions preserved. A backup contains active OAuth grant state, upstream login state, refresh token families, MCP session metadata, and rate-limit counters.

Restore steps:

1. Stop every service process that writes to the store.
2. Place the restored JSON file at `OAUTH_STORE_PATH`.
3. Set mode `0600` on the store file.
4. Set mode `0700` on the parent directory.
5. Start one service process and verify OAuth token refresh plus MCP session creation.

Restore a signing key backup with the matching store when active refresh tokens must remain usable across a recovery event.

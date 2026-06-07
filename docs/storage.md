# Storage

The service stores OAuth, rate limit, and MCP session state in one JSON file.

Production deployments provide the store path through `OAUTH_STORE_PATH`.

Local development uses `var/oauth-store.json` when an explicit path is absent.

Each update runs as a read-modify-write transaction.

Updates for the same path run through an in-process queue and a filesystem lock at `<store>.lock`.

The lock bounds concurrent writers across service processes.

The writer creates parent directories with mode `0700`.

The writer stores the JSON file with mode `0600`.

Existing store files must be regular files with mode `0600`.

The reader rejects symlinks and files readable by group or other accounts.

Each write uses a temporary file and an atomic rename into place.

Authorization codes and refresh tokens are stored as SHA-256 hashes.

MCP session IDs are stored as SHA-256 hashes.

Malformed JSON and unexpected record shapes stop the update.

A lock wait times out after five seconds.

Operators may remove a leftover lock file after confirming every service process that can write the store is stopped.

# Storage Model

The service stores OAuth, rate-limit, and MCP session state through one configured store. Production deployments use DynamoDB and store remote metadata cache entries in the same table. Local development uses the file store for OAuth, session, and rate-limit state by default.

## Record Groups

| Record group | Stored fields | Purpose |
| --- | --- | --- |
| Authorization codes | Code hash, client ID, redirect URI, resource, scopes, nonce, PKCE challenge, user profile, expiration, consumed time, auth time, creation time. | Complete the service authorization-code exchange after upstream OIDC login. |
| Upstream authorization states | State hash, client ID, redirect URI, resource, scopes, original client state, upstream PKCE verifier, nonce, expiration, creation time. | Preserve the validated ChatGPT authorization request while the browser signs in with the upstream IdP. |
| Refresh tokens | Token hash, family ID, client ID, user profile, resource, scopes, expiration, auth time, rotation parent, revoked time, creation time, last-used time. | Rotate refresh tokens and revoke a token family after replay. |
| MCP sessions | Session ID hash, client ID, protocol version, creation time, last-seen time, expiration, request ID hashes, initialized time, terminated time. | Maintain Streamable HTTP session state and request replay protection. |
| Rate-limit buckets | Sliding counter window start, previous count, current count, expiration time keyed by bucket plus hashed subject. | Enforce durable request limits across OAuth endpoints, MCP tools, and MCP resources. |
| Metadata cache entries | Cache key hash, JSON response body, expiration time. | Share Client ID Metadata Document and private key JWT JWKS cache results across production instances. |

DynamoDB accepts every record group in this table. The local file store accepts the OAuth, MCP session, and rate-limit groups. Missing local file groups are treated as empty maps. Stored map keys use fixed-length base64url hashes.

## Stored Secrets

The store keeps SHA-256 base64url hashes for authorization codes, upstream authorization states, refresh tokens, MCP session IDs, MCP request IDs, and rate-limit subjects. Production metadata cache keys use the same hash format.

Raw OAuth client secrets, upstream IdP client secrets, signing key material, fetched metadata URLs, and raw bearer material live outside the table. Production DynamoDB state keeps OAuth state, session state, rate state, and bounded public metadata cache bodies.

## Production Store

Production deployments use a single DynamoDB table with `pk` and `sk` primary keys, zero secondary indexes, TTL, point-in-time recovery, customer-managed KMS encryption, deletion protection, and retained table data. CDK writes `OAUTH_STORE_BACKEND`, `OAUTH_DYNAMODB_TABLE_NAME`, and `OAUTH_DYNAMODB_REGION` into Parameter Store.

The DynamoDB table serves every runtime access pattern through direct primary-key operations. Refresh token rotation uses transaction writes across token, family, and rotation marker items. Replay detection uses the rotation marker and revokes the family metadata item. Metadata cache entries use direct primary-key reads and writes with TTL.

See [DynamoDB Store](dynamodb-store.md) for key names, access patterns, and security controls.

## Local File Rules

The local file store is durable runtime state for development. It is owned by the service user and protected by strict file-mode and lock rules.

| Rule | Runtime behavior |
| --- | --- |
| Store path | The configured path must be present, trimmed, free of upward traversal segments, and end with `.json`. |
| Directory creation | The parent directory is created with `0700`. |
| Read handling | Missing store file returns an empty state. |
| Symlink handling | Store reads use `O_NOFOLLOW` and reject symlinks. |
| File type | Reads require a regular file. |
| File permissions | Existing store files must be owner-only. |
| Write permissions | Temporary store files are written with `0600`. |
| Write durability | Temporary files are fsynced before rename. The containing directory is fsynced after rename. |
| Parse errors | Malformed JSON stops the operation. |

## Local File Update Model

Each write uses a read-modify-write transaction. The service serializes same-process writes through an in-process queue and serializes multi-process writes through a filesystem lock.

The lock file uses exclusive create mode and owner-only permissions. Lock acquisition polls every 10 milliseconds and fails after 5 seconds. Each lock file contains a random owner token, process ID, hostname, creation time, and stale time. Expired lock metadata is removed before the next acquisition attempt.

Writes use temporary files and atomic rename after the in-memory state mutation succeeds. The runtime fsyncs the temporary file, renames it into place, and fsyncs the containing directory.

## Expiration And Replay Rules

| State | Expiration or replay behavior |
| --- | --- |
| Authorization code | Consumed once. Expired or consumed codes return `invalid_grant`. |
| Upstream authorization state | Consumed once and pruned when expired. |
| Refresh token | Rotates on use. Reuse of an older token revokes every token with the same family ID. |
| MCP session | Expires one hour after creation or terminates through `DELETE /mcp`. |
| MCP request ID | Stored as a hash per session. Duplicate IDs are rejected. A session accepts up to 4096 request IDs. |
| Rate-limit bucket | Expires after the current and previous sliding windows age out. |
| Metadata cache entry | Expires at the remote response cache lifetime, capped by the service maximum. |

## Runtime Secret Placement

The runner writes runtime secrets under `/run/<service-name>` and mounts that directory read-only into the container. OAuth client secrets, upstream client secrets, signing keys, and Parameter Store values stay outside the DynamoDB table.

Operator backup and restore rules are covered in [Storage Maintenance](../maintenance/storage.md). Parameter and secret placement are covered in [Runtime Parameters](../deployment/runtime-parameters.md).

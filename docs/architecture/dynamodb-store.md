# DynamoDB Store

Production deployments use one DynamoDB table for OAuth, MCP session, rate-limit, and remote metadata cache state. The table is an authentication data boundary and uses access-pattern keys, conditional writes, transactions, TTL, point-in-time recovery, and customer-managed KMS encryption.

## Table Shape

| Attribute | Role |
| --- | --- |
| `pk` | Partition key. Includes the record class and hashed lookup value. |
| `sk` | Sort key. Names the item role inside the partition. |
| `recordType` | Runtime item classifier. |
| `record` | JSON payload for records that must be reconstructed by the service. |
| `expiresAt` | Service expiration time in Unix seconds. |
| `ttl` | DynamoDB TTL attribute in Unix seconds. |

The table secondary index count is zero. Every runtime access pattern is served by a direct primary-key read, write, update, delete, or transaction.

## Runtime Provider

The service creates one DynamoDB store bundle per table name, Region, and endpoint. The bundle owns one DynamoDB HTTP client, one OAuth store, one rate-limit store, and one metadata cache store. Reusing the bundle keeps AWS credential caching and HTTP client construction stable across requests.

The cache key uses deployment identifiers only. It excludes secrets, account IDs, tokens, user identifiers, and request data.

## Access Patterns

| Access pattern | Primary key | Operation |
| --- | --- | --- |
| Create service authorization code | `AUTH_CODE#<codeHash>` / `STATE` | Conditional put. |
| Consume service authorization code | `AUTH_CODE#<codeHash>` / `STATE` | Strong read followed by conditional update. |
| Create upstream authorization state | `UPSTREAM_STATE#<stateHash>` / `STATE` | Conditional put. |
| Consume upstream authorization state | `UPSTREAM_STATE#<stateHash>` / `STATE` | Conditional delete with old item return. |
| Create refresh token | `REFRESH#<tokenHash>` / `TOKEN` and `REFRESH_FAMILY#<familyId>` / `META` | Transactional conditional puts. |
| Rotate refresh token | `REFRESH#<oldTokenHash>` / `TOKEN`, `REFRESH#<newTokenHash>` / `TOKEN`, `REFRESH_FAMILY#<familyId>` / `META`, `REFRESH_ROTATED#<oldTokenHash>` / `MARKER` | Transactional conditional writes. |
| Detect refresh replay | `REFRESH_ROTATED#<oldTokenHash>` / `MARKER` and `REFRESH_FAMILY#<familyId>` / `META` | Strong reads and conditional family revocation. |
| Save MCP session | `MCP_SESSION#<sessionHash>` / `SESSION` | Conditional put. |
| Touch MCP session | `MCP_SESSION#<sessionHash>` / `SESSION` | Conditional update. |
| Reserve MCP request ID | `MCP_SESSION#<sessionHash>` / `SESSION` | Strong read followed by conditional update. |
| Terminate MCP session | `MCP_SESSION#<sessionHash>` / `SESSION` | Conditional update. |
| Hit rate-limit bucket | `RATE2#<bucketSubjectHash>` / `BUCKET` | Strong read followed by conditional put. |
| Read Client ID Metadata Document cache | `CACHE#client-metadata#<cacheKeyHash>` / `ENTRY` | Strong read. |
| Write Client ID Metadata Document cache | `CACHE#client-metadata#<cacheKeyHash>` / `ENTRY` | Put or delete. |
| Read private key JWT JWKS cache | `CACHE#client-jwks#<cacheKeyHash>` / `ENTRY` | Strong read. |
| Write private key JWT JWKS cache | `CACHE#client-jwks#<cacheKeyHash>` / `ENTRY` | Put or delete. |

## Stored Data

The store saves hashes for authorization codes, upstream states, refresh tokens, MCP session IDs, MCP request IDs, rate-limit subjects, and metadata cache keys. Raw bearer tokens, refresh tokens, authorization codes, upstream states, session IDs, request IDs, client secrets, upstream client secrets, and signing keys stay outside the table.

User profile fields are stored with authorization-code and refresh-token records because token issuance needs the authenticated subject, email, display name, and verification status. Profile records use the normalized service profile shape. Profile records are reachable only through direct grant and token keys.

Client ID Metadata Document and private key JWT JWKS cache entries store bounded JSON response bodies. The source URLs are represented in keys only through SHA-256 base64url hashes. Cache entries use the remote response cache lifetime with the service maximum, and DynamoDB TTL removes expired entries.

Rate-limit bucket items store the sliding counter window start, previous window count, current window count, expiration time, and TTL. The durable key uses a hash of the bucket and normalized subject.

## Refresh Rotation

Refresh token rotation uses four primary-key items:

| Item | Purpose |
| --- | --- |
| Current token item | Stores the token hash, family ID, client binding, resource binding, scopes, profile, expiration, and auth time. |
| Family metadata item | Stores family status and revocation state. |
| New token item | Stores the replacement token record. |
| Rotation marker item | Records that the old token hash has already produced a replacement. |

The store checks the old token, family metadata, and rotation marker with strongly consistent reads. Rotation writes the new token, marker, old-token last-used time, and family TTL in one transaction. Replay of an older token revokes the family metadata item and returns `invalid_grant`.

## Security Controls

| Control | Implementation |
| --- | --- |
| Data minimization | Lookup secrets and request identifiers are stored as hashes. |
| Least privilege | The EC2 role receives only direct item and transaction actions on the state table. |
| Index minimization | Secondary index count is zero. |
| Recovery | Point-in-time recovery is enabled. |
| Expiration | TTL is enabled on `ttl`. |
| Encryption | The table uses a customer-managed KMS key with rotation enabled. |
| Deletion safety | CDK sets retention and deletion protection for the state table. |
| Concurrency | Consuming, rotating, replay handling, request ID reservation, and rate-limit writes use conditional expressions. |

## Local Development

Local development uses the file store by default. The file store keeps the same record groups and hash rules. Production configuration requires the DynamoDB backend.

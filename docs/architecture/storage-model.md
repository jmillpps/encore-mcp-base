# Storage Model

The service stores OAuth, rate-limit, and MCP session state in one JSON file. This keeps the initial deployment simple while preserving explicit durability and file ownership rules.

## Record Groups

| Record group | Purpose |
| --- | --- |
| Authorization codes | Code exchange state and PKCE metadata. |
| Upstream authorization states | Upstream IdP login state and original GPT redirect state. |
| Refresh tokens | Refresh rotation state and token family metadata. |
| MCP sessions | Streamable HTTP session state and request ID history. |
| Rate-limit buckets | Durable counters by bucket and subject. |

## Stored Secrets

The store keeps SHA-256 hashes for authorization codes, upstream authorization states, refresh tokens, and MCP session IDs.

Raw OAuth client secrets, upstream IdP client secrets, and signing key material live in Parameter Store. The runtime store keeps OAuth state and session state.

## Update Model

Each write uses a read-modify-write transaction. The service serializes same-process writes through an in-process queue and serializes multi-process writes through a filesystem lock.

Writes use temporary files and atomic rename. Malformed store files stop updates.

## Production Path

The CDK deployment sets `OAUTH_STORE_PATH` to `/var/lib/<service-name>/oauth-store.json`. The container mounts `/var/lib/<service-name>` for durable store access.

The runner writes runtime secrets under `/run/<service-name>` and mounts that directory read-only into the container.

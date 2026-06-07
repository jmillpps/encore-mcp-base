# Storage Model

The service stores OAuth, rate-limit, and MCP session state in one JSON file. This keeps the initial deployment simple while preserving explicit durability and file ownership rules.

## Record Groups

| Record group | Purpose |
| --- | --- |
| Authorization codes | Code exchange state and PKCE metadata. |
| Refresh tokens | Refresh rotation state and token family metadata. |
| MCP sessions | Streamable HTTP session state and request ID history. |
| Rate-limit buckets | Durable counters by bucket and subject. |

## Stored Secrets

The store keeps SHA-256 hashes for authorization codes, refresh tokens, and MCP session IDs.

## Update Model

Each write uses a read-modify-write transaction. The service serializes same-process writes through an in-process queue and serializes multi-process writes through a filesystem lock.

Writes use temporary files and atomic rename. Malformed store files stop updates.

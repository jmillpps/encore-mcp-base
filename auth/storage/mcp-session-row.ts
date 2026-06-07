import type { McpSessionRecord } from "./store-records.ts";
import { compact, hash, row, seconds, text, type DiskRow } from "./store-row-primitives.ts";
import { optionalOrderedSeconds, orderedSeconds } from "./store-row-time.ts";

export function mcpSessionFromDisk(value: unknown): McpSessionRecord {
  const record = row(value, ["session_id_hash", "client_id", "protocol_version", "created_at", "last_seen_at", "expires_at", "initialized_at", "terminated_at"]);
  const createdAt = seconds(record, "created_at");
  return {
    sessionIdHash: hash(record, "session_id_hash"),
    clientId: text(record, "client_id"),
    protocolVersion: text(record, "protocol_version"),
    createdAt,
    lastSeenAt: orderedSeconds(record, "last_seen_at", createdAt),
    expiresAt: orderedSeconds(record, "expires_at", createdAt),
    initializedAt: optionalOrderedSeconds(record, "initialized_at", createdAt),
    terminatedAt: optionalOrderedSeconds(record, "terminated_at", createdAt),
  };
}

export function mcpSessionToDisk(record: McpSessionRecord): DiskRow {
  return compact({
    session_id_hash: record.sessionIdHash,
    client_id: record.clientId,
    protocol_version: record.protocolVersion,
    created_at: record.createdAt,
    last_seen_at: record.lastSeenAt,
    expires_at: record.expiresAt,
    initialized_at: record.initializedAt,
    terminated_at: record.terminatedAt,
  });
}

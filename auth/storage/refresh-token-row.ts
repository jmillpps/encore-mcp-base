import { userProfileFromJson, userProfileJson } from "../user-profile.ts";
import type { RefreshTokenRecord } from "./store-records.ts";
import { compact, hash, optionalHash, row, scopes, scopesJson, seconds, text, type DiskRow } from "./store-row-primitives.ts";
import { authTime, optionalOrderedSeconds, orderedSeconds } from "./store-row-time.ts";

export function refreshTokenFromDisk(value: unknown): RefreshTokenRecord {
  const record = row(value, [
    "token_hash",
    "family_id",
    "client_id",
    "user_json",
    "resource",
    "scopes_json",
    "expires_at",
    "auth_time",
    "rotated_from_hash",
    "revoked_at",
    "created_at",
    "last_used_at",
  ]);
  const createdAt = seconds(record, "created_at");
  return {
    tokenHash: hash(record, "token_hash"),
    familyId: text(record, "family_id"),
    clientId: text(record, "client_id"),
    user: userProfileFromJson(text(record, "user_json")),
    resource: text(record, "resource"),
    scopes: scopes(record),
    expiresAt: orderedSeconds(record, "expires_at", createdAt),
    authTime: authTime(record, createdAt),
    rotatedFromHash: optionalHash(record, "rotated_from_hash"),
    revokedAt: optionalOrderedSeconds(record, "revoked_at", createdAt),
    createdAt,
    lastUsedAt: optionalOrderedSeconds(record, "last_used_at", createdAt),
  };
}

export function refreshTokenToDisk(record: RefreshTokenRecord): DiskRow {
  return compact({
    token_hash: record.tokenHash,
    family_id: record.familyId,
    client_id: record.clientId,
    user_json: userProfileJson(record.user),
    resource: record.resource,
    scopes_json: scopesJson(record.scopes),
    expires_at: record.expiresAt,
    auth_time: record.authTime,
    rotated_from_hash: record.rotatedFromHash,
    revoked_at: record.revokedAt,
    created_at: record.createdAt,
    last_used_at: record.lastUsedAt,
  });
}

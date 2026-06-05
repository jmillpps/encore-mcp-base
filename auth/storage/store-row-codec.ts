import type { AuthorizationCodeRecord, McpSessionRecord, RefreshTokenRecord } from "./store-records.ts";
import { isOidcNonce } from "../nonce.ts";
import {
  compact,
  hash,
  malformed,
  methodS256,
  optionalHash,
  optionalSeconds,
  optionalText,
  row,
  scopes,
  scopesJson,
  seconds,
  text,
  type DiskRow,
} from "./store-row-primitives.ts";

export function authorizationCodeFromDisk(value: unknown): AuthorizationCodeRecord {
  const record = row(value, [
    "code_hash",
    "client_id",
    "redirect_uri",
    "resource",
    "scopes_json",
    "nonce",
    "code_challenge",
    "code_challenge_method",
    "user_sub",
    "expires_at",
    "consumed_at",
    "auth_time",
    "created_at",
  ]);
  return {
    codeHash: hash(record, "code_hash"),
    clientId: text(record, "client_id"),
    redirectUri: text(record, "redirect_uri"),
    resource: text(record, "resource"),
    scopes: scopes(record),
    nonce: optionalNonce(record, "nonce"),
    codeChallenge: optionalHash(record, "code_challenge"),
    codeChallengeMethod: methodS256(record, "code_challenge_method"),
    userSub: text(record, "user_sub"),
    expiresAt: seconds(record, "expires_at"),
    consumedAt: optionalSeconds(record, "consumed_at"),
    authTime: seconds(record, "auth_time"),
    createdAt: seconds(record, "created_at"),
  };
}

export function authorizationCodeToDisk(record: AuthorizationCodeRecord): DiskRow {
  return compact({
    code_hash: record.codeHash,
    client_id: record.clientId,
    redirect_uri: record.redirectUri,
    resource: record.resource,
    scopes_json: scopesJson(record.scopes),
    nonce: record.nonce,
    code_challenge: record.codeChallenge,
    code_challenge_method: record.codeChallengeMethod,
    user_sub: record.userSub,
    expires_at: record.expiresAt,
    consumed_at: record.consumedAt,
    auth_time: record.authTime,
    created_at: record.createdAt,
  });
}

export function refreshTokenFromDisk(value: unknown): RefreshTokenRecord {
  const record = row(value, [
    "token_hash",
    "family_id",
    "client_id",
    "user_sub",
    "resource",
    "scopes_json",
    "expires_at",
    "auth_time",
    "rotated_from_hash",
    "revoked_at",
    "created_at",
    "last_used_at",
  ]);
  return {
    tokenHash: hash(record, "token_hash"),
    familyId: text(record, "family_id"),
    clientId: text(record, "client_id"),
    userSub: text(record, "user_sub"),
    resource: text(record, "resource"),
    scopes: scopes(record),
    expiresAt: seconds(record, "expires_at"),
    authTime: seconds(record, "auth_time"),
    rotatedFromHash: optionalHash(record, "rotated_from_hash"),
    revokedAt: optionalSeconds(record, "revoked_at"),
    createdAt: seconds(record, "created_at"),
    lastUsedAt: optionalSeconds(record, "last_used_at"),
  };
}

export function refreshTokenToDisk(record: RefreshTokenRecord): DiskRow {
  return compact({
    token_hash: record.tokenHash,
    family_id: record.familyId,
    client_id: record.clientId,
    user_sub: record.userSub,
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

export function mcpSessionFromDisk(value: unknown): McpSessionRecord {
  const record = row(value, ["session_id_hash", "client_id", "protocol_version", "created_at", "last_seen_at", "expires_at", "terminated_at"]);
  return {
    sessionIdHash: hash(record, "session_id_hash"),
    clientId: text(record, "client_id"),
    protocolVersion: text(record, "protocol_version"),
    createdAt: seconds(record, "created_at"),
    lastSeenAt: seconds(record, "last_seen_at"),
    expiresAt: seconds(record, "expires_at"),
    terminatedAt: optionalSeconds(record, "terminated_at"),
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
    terminated_at: record.terminatedAt,
  });
}

export function rateLimitFromDisk(value: unknown): { count: number; resetAt: number } {
  const record = row(value, ["count", "reset_at"]);
  return { count: seconds(record, "count"), resetAt: seconds(record, "reset_at") };
}

export function rateLimitToDisk(record: { count: number; resetAt: number }): DiskRow {
  return { count: record.count, reset_at: record.resetAt };
}

function optionalNonce(record: DiskRow, key: string): string | undefined {
  const value = optionalText(record, key);
  if (value === undefined) return undefined;
  if (!isOidcNonce(value)) malformed();
  return value;
}

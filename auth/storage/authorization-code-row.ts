import { isOidcNonce } from "../nonce.ts";
import { userProfileFromJson, userProfileJson } from "../user-profile.ts";
import type { AuthorizationCodeRecord } from "./store-records.ts";
import { compact, hash, malformed, methodS256, optionalHash, optionalText, row, scopes, scopesJson, seconds, text, type DiskRow } from "./store-row-primitives.ts";
import { authTime, optionalOrderedSeconds, orderedSeconds } from "./store-row-time.ts";

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
    "user_json",
    "expires_at",
    "consumed_at",
    "auth_time",
    "created_at",
  ]);
  const createdAt = seconds(record, "created_at");
  return {
    codeHash: hash(record, "code_hash"),
    clientId: text(record, "client_id"),
    redirectUri: text(record, "redirect_uri"),
    resource: text(record, "resource"),
    scopes: scopes(record),
    nonce: optionalNonce(record, "nonce"),
    codeChallenge: optionalHash(record, "code_challenge"),
    codeChallengeMethod: methodS256(record, "code_challenge_method"),
    user: userProfileFromJson(text(record, "user_json")),
    expiresAt: orderedSeconds(record, "expires_at", createdAt),
    consumedAt: optionalOrderedSeconds(record, "consumed_at", createdAt),
    authTime: authTime(record, createdAt),
    createdAt,
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
    user_json: userProfileJson(record.user),
    expires_at: record.expiresAt,
    consumed_at: record.consumedAt,
    auth_time: record.authTime,
    created_at: record.createdAt,
  });
}

function optionalNonce(record: DiskRow, key: string): string | undefined {
  const value = optionalText(record, key);
  if (value === undefined) return undefined;
  if (!isOidcNonce(value)) malformed();
  return value;
}

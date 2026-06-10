import { isOidcNonce } from "../nonce.ts";
import type { UpstreamAuthorizationStateRecord } from "./store-records.ts";
import { compact, hash, malformed, methodS256, optionalHash, optionalText, row, scopes, scopesJson, seconds, text, type DiskRow } from "./store-row-primitives.ts";
import { orderedSeconds } from "./store-row-time.ts";

export function upstreamAuthorizationStateFromDisk(value: unknown): UpstreamAuthorizationStateRecord {
  const record = row(value, [
    "state_hash",
    "client_id",
    "redirect_uri",
    "resource",
    "scopes_json",
    "client_state",
    "code_verifier",
    "upstream_nonce",
    "nonce",
    "code_challenge",
    "code_challenge_method",
    "expires_at",
    "created_at",
  ]);
  const createdAt = seconds(record, "created_at");
  return {
    stateHash: hash(record, "state_hash"),
    clientId: text(record, "client_id"),
    redirectUri: text(record, "redirect_uri"),
    resource: text(record, "resource"),
    scopes: scopes(record),
    clientState: text(record, "client_state"),
    codeVerifier: text(record, "code_verifier"),
    upstreamNonce: nonce(record, "upstream_nonce"),
    nonce: optionalNonce(record, "nonce"),
    codeChallenge: optionalHash(record, "code_challenge"),
    codeChallengeMethod: methodS256(record, "code_challenge_method"),
    expiresAt: orderedSeconds(record, "expires_at", createdAt),
    createdAt,
  };
}

export function upstreamAuthorizationStateToDisk(record: UpstreamAuthorizationStateRecord): DiskRow {
  return compact({
    state_hash: record.stateHash,
    client_id: record.clientId,
    redirect_uri: record.redirectUri,
    resource: record.resource,
    scopes_json: scopesJson(record.scopes),
    client_state: record.clientState,
    code_verifier: record.codeVerifier,
    upstream_nonce: record.upstreamNonce,
    nonce: record.nonce,
    code_challenge: record.codeChallenge,
    code_challenge_method: record.codeChallengeMethod,
    expires_at: record.expiresAt,
    created_at: record.createdAt,
  });
}

function nonce(record: DiskRow, key: string): string {
  const value = text(record, key);
  if (!isOidcNonce(value)) malformed();
  return value;
}

function optionalNonce(record: DiskRow, key: string): string | undefined {
  const value = optionalText(record, key);
  if (value === undefined) return undefined;
  if (!isOidcNonce(value)) malformed();
  return value;
}

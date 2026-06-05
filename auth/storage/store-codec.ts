import { emptyStoreState, type OAuthStoreState } from "./store-records.ts";
import { authorizationCodeFromDisk, authorizationCodeToDisk } from "./authorization-code-row.ts";
import { mcpSessionFromDisk, mcpSessionToDisk } from "./mcp-session-row.ts";
import { rateLimitFromDisk, rateLimitToDisk } from "./rate-limit-row.ts";
import { refreshTokenFromDisk, refreshTokenToDisk } from "./refresh-token-row.ts";
import { malformed, type DiskRow } from "./store-row-primitives.ts";

const mapKeyPattern = /^[A-Za-z0-9_-]{43}$/;

export function normalizeStore(value: unknown): OAuthStoreState {
  const record = storeRecord(value);
  const state = emptyStoreState();
  state.authorizationCodes = normalizeMap(record.authorizationCodes, authorizationCodeFromDisk);
  state.refreshTokens = normalizeMap(record.refreshTokens, refreshTokenFromDisk);
  state.mcpSessions = normalizeMap(record.mcpSessions, mcpSessionFromDisk);
  state.rateLimits = normalizeMap(record.rateLimits, rateLimitFromDisk);
  return state;
}

export function serializeStore(state: OAuthStoreState): DiskRow {
  return {
    authorizationCodes: serializeMap(state.authorizationCodes, authorizationCodeToDisk),
    refreshTokens: serializeMap(state.refreshTokens, refreshTokenToDisk),
    mcpSessions: serializeMap(state.mcpSessions, mcpSessionToDisk),
    rateLimits: serializeMap(state.rateLimits, rateLimitToDisk),
  };
}

function storeRecord(value: unknown): DiskRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) malformed();
  const record = value as DiskRow;
  if (Object.keys(record).some((key) => !["authorizationCodes", "refreshTokens", "mcpSessions", "rateLimits"].includes(key))) malformed();
  return record;
}

function normalizeMap<T>(value: unknown, normalize: (value: unknown) => T): Record<string, T> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) malformed();
  return Object.fromEntries(Object.entries(value as DiskRow).map(([key, entry]) => [mapKey(key), normalize(entry)]));
}

function serializeMap<T>(value: Record<string, T>, serialize: (value: T) => DiskRow): DiskRow {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [mapKey(key), serialize(entry)]));
}

function mapKey(value: string): string {
  if (!mapKeyPattern.test(value)) malformed();
  return value;
}

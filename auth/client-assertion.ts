import { createPublicKey, type KeyObject } from "node:crypto";
import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { nowSeconds } from "../shared/time.ts";
import { fetchMetadataDocument } from "./client-metadata-fetch.ts";
import { resolveMetadataNetworkAddress } from "./client-metadata-network.ts";
import type { OAuthClient } from "./client-types.ts";
import { readExpiringCache, writeExpiringCache, type ExpiringCacheEntry } from "./expiring-cache.ts";
import { jwtKid, verifyJwt } from "./tokens/jwt.ts";

const maximumAssertionLifetimeSeconds = 300;
const assertionClockSkewSeconds = 60;
const minimumClientJwksRsaModulusBits = 2048;
const maximumClientJwksCacheEntries = 64;
const replayCache = new Map<string, number>();
const jwksCache = new Map<string, ExpiringCacheEntry<Map<string, KeyObject>>>();

export async function assertPrivateKeyJwtClientAssertion(config: ServiceConfig, client: OAuthClient, assertion: string | undefined): Promise<void> {
  if (!assertion || !client.jwksUri) throw invalidClient();
  try {
    const key = await clientAssertionKey(config, client.jwksUri, assertion);
    validateAssertionClaims(config, client, verifyJwt(assertion, key));
  } catch (error) {
    if (error instanceof ServiceError && error.code === "invalid_client") throw error;
    throw invalidClient();
  }
}

async function clientAssertionKey(config: ServiceConfig, jwksUri: string, assertion: string): Promise<KeyObject> {
  const kid = jwtKid(assertion);
  const keys = await clientJwks(config, jwksUri);
  const key = keys.get(kid);
  if (!key) throw invalidClient();
  return key;
}

async function clientJwks(config: ServiceConfig, jwksUri: string): Promise<Map<string, KeyObject>> {
  const cacheKey = `${config.production}\0${jwksUri}`;
  const cached = readExpiringCache(jwksCache, cacheKey);
  if (cached) return cached;
  const url = new URL(jwksUri);
  const fetched = await fetchMetadataDocument(url, await resolveMetadataNetworkAddress(url, config.production));
  const keys = parseJwks(fetched.body);
  writeExpiringCache(jwksCache, cacheKey, keys, fetched.cacheSeconds, maximumClientJwksCacheEntries);
  return keys;
}

function parseJwks(body: unknown): Map<string, KeyObject> {
  const record = objectRecord(body);
  const values = record.keys;
  if (!Array.isArray(values) || values.length === 0) throw invalidClient();
  const keys = new Map<string, KeyObject>();
  for (const value of values) {
    const key = parseJwk(value);
    if (keys.has(key.kid)) throw invalidClient();
    keys.set(key.kid, key.publicKey);
  }
  return keys;
}

function parseJwk(value: unknown): { kid: string; publicKey: KeyObject } {
  const record = objectRecord(value);
  if (record.kty !== "RSA" || typeof record.n !== "string" || typeof record.e !== "string") throw invalidClient();
  if (record.use !== undefined && record.use !== "sig") throw invalidClient();
  if (record.alg !== undefined && record.alg !== "RS256") throw invalidClient();
  if (record.key_ops !== undefined && (!Array.isArray(record.key_ops) || !record.key_ops.includes("verify"))) throw invalidClient();
  const kid = safeString(record.kid);
  const publicKey = createPublicKey({ key: { kty: "RSA", n: record.n, e: record.e }, format: "jwk" });
  if (!strongClientJwksRsaKey(publicKey)) throw invalidClient();
  return { kid, publicKey };
}

function strongClientJwksRsaKey(key: KeyObject): boolean {
  if (key.asymmetricKeyType !== "rsa") return false;
  const modulusLength = key.asymmetricKeyDetails?.modulusLength;
  return typeof modulusLength === "number" && modulusLength >= minimumClientJwksRsaModulusBits;
}

function validateAssertionClaims(config: ServiceConfig, client: OAuthClient, claims: Record<string, unknown>): void {
  const now = nowSeconds();
  if (claims.iss !== client.clientId || claims.sub !== client.clientId) throw invalidClient();
  if (!audienceMatches(config, claims.aud)) throw invalidClient();
  const exp = numericDate(claims.exp);
  if (exp <= now - assertionClockSkewSeconds || exp > now + maximumAssertionLifetimeSeconds + assertionClockSkewSeconds) throw invalidClient();
  if (claims.nbf !== undefined && numericDate(claims.nbf) > now + assertionClockSkewSeconds) throw invalidClient();
  if (claims.iat !== undefined) validateIssuedAt(numericDate(claims.iat), now);
  if (claims.jti !== undefined) rejectReplay(client.clientId, safeString(claims.jti), exp, now);
}

function validateIssuedAt(iat: number, now: number): void {
  if (iat > now + assertionClockSkewSeconds || iat < now - maximumAssertionLifetimeSeconds - assertionClockSkewSeconds) throw invalidClient();
}

function audienceMatches(config: ServiceConfig, aud: unknown): boolean {
  const accepted = new Set([config.issuer, `${config.issuer}/oauth/token`]);
  if (typeof aud === "string") return accepted.has(aud);
  if (Array.isArray(aud)) return aud.some((value) => typeof value === "string" && accepted.has(value));
  return false;
}

function rejectReplay(clientId: string, jti: string, exp: number, now: number): void {
  for (const [key, expiresAt] of replayCache) {
    if (expiresAt <= now) replayCache.delete(key);
  }
  const key = `${clientId}\0${jti}`;
  if (replayCache.has(key)) throw invalidClient();
  replayCache.set(key, exp + assertionClockSkewSeconds);
}

function numericDate(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw invalidClient();
  return value;
}

function safeString(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,256}$/.test(value)) throw invalidClient();
  return value;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalidClient();
  return value as Record<string, unknown>;
}

function invalidClient(): ServiceError {
  return new ServiceError("invalid_client", "invalid client", 401);
}

import type { ServiceConfig } from "../shared/config.ts";
import type { OAuthClient } from "./client-types.ts";
import { fetchMetadataDocument } from "./client-metadata-fetch.ts";
import { parseMetadataClient } from "./client-metadata-parser.ts";
import { parseClientIdUrl, resolveMetadataNetworkAddress } from "./client-metadata-network.ts";
import { readExpiringCache, writeExpiringCache, type ExpiringCacheEntry } from "./expiring-cache.ts";
import { metadataCacheStore } from "./storage/store-provider.ts";
import type { MetadataCacheEntry, MetadataCacheStore } from "./storage/metadata-cache-store.ts";

const maximumMetadataCacheEntries = 64;
const metadataCache = new Map<string, ExpiringCacheEntry<OAuthClient>>();

export async function resolveClientIdMetadataDocument(config: ServiceConfig, clientId: string): Promise<OAuthClient> {
  const url = parseClientIdUrl(clientId, config.production);
  const networkAddress = await resolveMetadataNetworkAddress(url, config.production);
  const cacheKey = `${config.mcpResource}\0${config.production}\0${clientId}`;
  const cached = readExpiringCache(metadataCache, cacheKey);
  if (cached) return cached;
  const durableCache = metadataCacheStore(config);
  const durableEntry = await durableCache?.read("client-metadata", cacheKey);
  if (durableEntry) return cachedMetadataClient(config, clientId, cacheKey, durableEntry);
  const fetched = await fetchMetadataDocument(url, networkAddress);
  const client = parseMetadataClient(config, clientId, fetched.body);
  writeExpiringCache(metadataCache, cacheKey, client, fetched.cacheSeconds, maximumMetadataCacheEntries);
  await writeDurableCache(durableCache, "client-metadata", cacheKey, fetched.body, fetched.cacheSeconds);
  return client;
}

function cachedMetadataClient(config: ServiceConfig, clientId: string, cacheKey: string, entry: MetadataCacheEntry): OAuthClient {
  const client = parseMetadataClient(config, clientId, entry.body);
  writeExpiringCache(metadataCache, cacheKey, client, cacheSecondsRemaining(entry.expiresAt), maximumMetadataCacheEntries);
  return client;
}

async function writeDurableCache(store: MetadataCacheStore | undefined, namespace: "client-metadata", key: string, body: unknown, cacheSeconds: number): Promise<void> {
  if (store) await store.write(namespace, key, body, cacheSeconds);
}

function cacheSecondsRemaining(expiresAt: number): number {
  return Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
}

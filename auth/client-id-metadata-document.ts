import type { ServiceConfig } from "../shared/config.ts";
import type { OAuthClient } from "./client-types.ts";
import { fetchMetadataDocument } from "./client-metadata-fetch.ts";
import { parseMetadataClient } from "./client-metadata-parser.ts";
import { parseClientIdUrl, resolveMetadataNetworkAddress } from "./client-metadata-network.ts";
import { readExpiringCache, writeExpiringCache, type ExpiringCacheEntry } from "./expiring-cache.ts";

const maximumMetadataCacheEntries = 64;
const metadataCache = new Map<string, ExpiringCacheEntry<OAuthClient>>();

export async function resolveClientIdMetadataDocument(config: ServiceConfig, clientId: string): Promise<OAuthClient> {
  const url = parseClientIdUrl(clientId, config.production);
  const networkAddress = await resolveMetadataNetworkAddress(url, config.production);
  const cacheKey = `${config.mcpResource}\0${config.production}\0${clientId}`;
  const cached = readExpiringCache(metadataCache, cacheKey);
  if (cached) return cached;
  const fetched = await fetchMetadataDocument(url, networkAddress);
  const client = parseMetadataClient(config, clientId, fetched.body);
  writeExpiringCache(metadataCache, cacheKey, client, fetched.cacheSeconds, maximumMetadataCacheEntries);
  return client;
}

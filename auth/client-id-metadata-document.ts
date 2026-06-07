import type { ServiceConfig } from "../shared/config.ts";
import type { OAuthClient } from "./client-types.ts";
import { fetchMetadataDocument } from "./client-metadata-fetch.ts";
import { parseMetadataClient } from "./client-metadata-parser.ts";
import { parseClientIdUrl, resolveMetadataNetworkAddress } from "./client-metadata-network.ts";

interface CachedMetadataClient {
  client: OAuthClient;
  expiresAt: number;
}

const metadataCache = new Map<string, CachedMetadataClient>();

export async function resolveClientIdMetadataDocument(config: ServiceConfig, clientId: string): Promise<OAuthClient> {
  const url = parseClientIdUrl(clientId, config.production);
  const networkAddress = await resolveMetadataNetworkAddress(url, config.production);
  const cacheKey = `${config.mcpResource}\0${config.production}\0${clientId}`;
  const cached = metadataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.client;
  const fetched = await fetchMetadataDocument(url, networkAddress);
  const client = parseMetadataClient(config, clientId, fetched.body);
  metadataCache.set(cacheKey, { client, expiresAt: Date.now() + fetched.cacheSeconds * 1000 });
  return client;
}

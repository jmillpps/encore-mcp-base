export type MetadataCacheNamespace = "client-metadata" | "client-jwks";

export interface MetadataCacheEntry {
  body: unknown;
  expiresAt: number;
}

export interface MetadataCacheStore {
  read(namespace: MetadataCacheNamespace, key: string): Promise<MetadataCacheEntry | undefined>;
  write(namespace: MetadataCacheNamespace, key: string, body: unknown, cacheSeconds: number): Promise<void>;
}

export interface ExpiringCacheEntry<T> {
  value: T;
  expiresAt: number;
}

export function readExpiringCache<T>(cache: Map<string, ExpiringCacheEntry<T>>, key: string, now = Date.now()): T | undefined {
  pruneExpiredCacheEntries(cache, now);
  return cache.get(key)?.value;
}

export function writeExpiringCache<T>(cache: Map<string, ExpiringCacheEntry<T>>, key: string, value: T, cacheSeconds: number, maxEntries: number, now = Date.now()): void {
  pruneExpiredCacheEntries(cache, now);
  if (cacheSeconds <= 0) {
    cache.delete(key);
    return;
  }
  while (!cache.has(key) && cache.size >= maxEntries) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: now + cacheSeconds * 1000 });
}

function pruneExpiredCacheEntries<T>(cache: Map<string, ExpiringCacheEntry<T>>, now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

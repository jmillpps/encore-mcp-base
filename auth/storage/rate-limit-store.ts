import { sha256Base64Url } from "../../shared/crypto.ts";
import { ServiceError } from "../../shared/errors.ts";
import { nowSeconds } from "../../shared/time.ts";
import { StoreFile } from "./store-file.ts";

export class DiskRateLimitStore {
  private readonly file: StoreFile;

  constructor(path: string) {
    this.file = new StoreFile(path);
  }

  async hit(key: string, windowSeconds: number, maxRequests: number): Promise<void> {
    const keyHash = sha256Base64Url(key);
    await this.file.update((state) => {
      const now = nowSeconds();
      pruneExpiredRateLimits(state.rateLimits, now);
      const existing = state.rateLimits[keyHash];
      if (!existing || existing.resetAt <= now) {
        state.rateLimits[keyHash] = { count: 1, resetAt: now + windowSeconds };
        return;
      }
      if (existing.count >= maxRequests) throw new ServiceError("rate_limited", "rate limit exceeded", 429);
      existing.count += 1;
    });
  }
}

function pruneExpiredRateLimits(rateLimits: Record<string, { resetAt: number }>, now: number): void {
  for (const [key, record] of Object.entries(rateLimits)) {
    if (record.resetAt <= now) delete rateLimits[key];
  }
}

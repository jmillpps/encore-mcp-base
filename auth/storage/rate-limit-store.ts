import { sha256Base64Url } from "../../shared/crypto.ts";
import type { RateLimitPolicy } from "../../shared/config.ts";
import { nowSeconds } from "../../shared/time.ts";
import { nextRateLimitRecord } from "./rate-limit-algorithm.ts";
import { StoreFile } from "./store-file.ts";
import type { RateLimitRecord } from "./store-records.ts";

export class DiskRateLimitStore {
  private readonly file: StoreFile;

  constructor(path: string) {
    this.file = new StoreFile(path);
  }

  async hit(key: string, policy: RateLimitPolicy): Promise<void> {
    const keyHash = sha256Base64Url(key);
    await this.file.update((state) => {
      const now = nowSeconds();
      pruneExpiredRateLimits(state.rateLimits, now);
      state.rateLimits[keyHash] = nextRateLimitRecord(state.rateLimits[keyHash], policy, now);
    });
  }
}

function pruneExpiredRateLimits(rateLimits: Record<string, RateLimitRecord>, now: number): void {
  for (const [key, record] of Object.entries(rateLimits)) {
    if (record.expiresAt <= now) delete rateLimits[key];
  }
}

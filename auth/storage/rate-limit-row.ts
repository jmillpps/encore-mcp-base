import { row, seconds, type DiskRow } from "./store-row-primitives.ts";
import type { RateLimitRecord } from "./store-records.ts";

export function rateLimitFromDisk(value: unknown): RateLimitRecord {
  const record = row(value, ["window_start", "previous_count", "current_count", "expires_at"]);
  return {
    windowStart: seconds(record, "window_start"),
    previousCount: seconds(record, "previous_count"),
    currentCount: seconds(record, "current_count"),
    expiresAt: seconds(record, "expires_at"),
  };
}

export function rateLimitToDisk(record: RateLimitRecord): DiskRow {
  return {
    window_start: record.windowStart,
    previous_count: record.previousCount,
    current_count: record.currentCount,
    expires_at: record.expiresAt,
  };
}

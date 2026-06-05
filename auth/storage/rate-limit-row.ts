import { row, seconds, type DiskRow } from "./store-row-primitives.ts";

export function rateLimitFromDisk(value: unknown): { count: number; resetAt: number } {
  const record = row(value, ["count", "reset_at"]);
  return { count: seconds(record, "count"), resetAt: seconds(record, "reset_at") };
}

export function rateLimitToDisk(record: { count: number; resetAt: number }): DiskRow {
  return { count: record.count, reset_at: record.resetAt };
}

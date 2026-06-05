import { malformed, optionalSeconds, seconds, type DiskRow } from "./store-row-primitives.ts";

export function authTime(record: DiskRow, createdAt: number): number {
  const value = seconds(record, "auth_time");
  if (value > createdAt) malformed();
  return value;
}

export function orderedSeconds(record: DiskRow, key: string, minimum: number): number {
  const value = seconds(record, key);
  if (value < minimum) malformed();
  return value;
}

export function optionalOrderedSeconds(record: DiskRow, key: string, minimum: number): number | undefined {
  const value = optionalSeconds(record, key);
  if (value === undefined) return undefined;
  if (value < minimum) malformed();
  return value;
}

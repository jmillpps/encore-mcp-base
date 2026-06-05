import { badRequest } from "./errors.ts";

export function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw badRequest(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw badRequest(`${key} must be a string`);
  return value;
}

export function requiredString(record: Record<string, unknown>, key: string): string {
  const value = optionalString(record, key);
  if (!value) throw badRequest(`${key} is required`);
  return value;
}

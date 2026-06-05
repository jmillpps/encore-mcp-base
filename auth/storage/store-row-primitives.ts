export type DiskRow = Record<string, unknown>;

const hashPattern = /^[A-Za-z0-9_-]{43}$/;

export function row(value: unknown, allowedKeys: string[]): DiskRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) malformed();
  const record = value as DiskRow;
  if (Object.keys(record).some((key) => !allowedKeys.includes(key))) malformed();
  return record;
}

export function text(record: DiskRow, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") malformed();
  return value;
}

export function optionalText(record: DiskRow, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") malformed();
  return value;
}

export function hash(record: DiskRow, key: string): string {
  const value = text(record, key);
  if (!hashPattern.test(value)) malformed();
  return value;
}

export function optionalHash(record: DiskRow, key: string): string | undefined {
  const value = optionalText(record, key);
  if (value === undefined) return undefined;
  if (!hashPattern.test(value)) malformed();
  return value;
}

export function seconds(record: DiskRow, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) malformed();
  return value;
}

export function optionalSeconds(record: DiskRow, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) malformed();
  return value;
}

export function scopes(record: DiskRow): string[] {
  const value = text(record, "scopes_json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    malformed();
  }
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string" || entry.trim() === "")) malformed();
  return parsed;
}

export function methodS256(record: DiskRow, key: string): "S256" | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (value !== "S256") malformed();
  return "S256";
}

export function compact(record: DiskRow): DiskRow {
  return Object.fromEntries(Object.entries(record).filter((entry) => entry[1] !== undefined));
}

export function scopesJson(values: string[]): string {
  return JSON.stringify(values);
}

export function malformed(): never {
  throw new Error("store file is malformed");
}

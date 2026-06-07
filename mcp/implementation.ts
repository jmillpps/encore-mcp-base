import { badRequest } from "../shared/errors.ts";
import { asRecord, optionalString, requiredString } from "../shared/json.ts";

const implementationNamePattern = /^[A-Za-z0-9._:/ -]{1,128}$/;
const implementationVersionPattern = /^[\x20-\x7E]{1,128}$/;

export function validateImplementation(value: unknown, field: string): Record<string, unknown> {
  const record = asRecord(value, field);
  assertKeys(record, ["icons", "name", "title", "version", "description", "websiteUrl"], field);
  implementationName(record);
  implementationVersion(record);
  optionalString(record, "title");
  optionalString(record, "description");
  validateWebsiteUrl(record.websiteUrl);
  validateIcons(record.icons);
  return record;
}

export function implementationName(record: Record<string, unknown>): string {
  const name = requiredString(record, "name");
  if (!implementationNamePattern.test(name)) throw badRequest("clientInfo.name is invalid");
  return name;
}

function implementationVersion(record: Record<string, unknown>): void {
  const version = requiredString(record, "version");
  if (!implementationVersionPattern.test(version)) throw badRequest("clientInfo.version is invalid");
}

function validateWebsiteUrl(value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== "string") throw badRequest("websiteUrl must be a string");
  validateUrl(value, "websiteUrl", ["http:", "https:"]);
}

function validateIcons(value: unknown): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw badRequest("icons must be an array");
  for (const icon of value) validateIcon(icon);
}

function validateIcon(value: unknown): void {
  const record = asRecord(value, "icon");
  assertKeys(record, ["src", "mimeType", "sizes", "theme"], "icon");
  const src = requiredString(record, "src");
  validateUrl(src, "src", ["http:", "https:", "data:"]);
  optionalString(record, "mimeType");
  validateSizes(record.sizes);
  validateTheme(record.theme);
}

function validateSizes(value: unknown): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((size) => typeof size !== "string")) throw badRequest("sizes must be a string array");
}

function validateTheme(value: unknown): void {
  if (value !== undefined && value !== "light" && value !== "dark") throw badRequest("theme must be light or dark");
}

function assertKeys(record: Record<string, unknown>, allowed: readonly string[], name: string): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) throw badRequest(`${name} contains unsupported fields`);
}

function validateUrl(value: string, field: string, protocols: readonly string[]): void {
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol)) throw new Error("invalid protocol");
  } catch {
    throw badRequest(`${field} must be a valid URL`);
  }
}

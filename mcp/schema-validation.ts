import { ServiceError } from "../shared/errors.ts";

export function assertMatchesSchema(schema: Record<string, unknown>, value: unknown): void {
  if (!matchesSchema(schema, value)) throw new ServiceError("server_error", "invalid tool output", 500);
}

function matchesSchema(schema: Record<string, unknown>, value: unknown): boolean {
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) return false;
  const type = schema.type;
  if (type === "object") return matchesObject(schema, value);
  if (type === "array") return matchesArray(schema, value);
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "integer") return Number.isSafeInteger(value);
  return false;
}

function matchesObject(schema: Record<string, unknown>, value: unknown): boolean {
  if (!isRecord(value)) return false;
  const properties = schemaProperties(schema);
  if (!properties) return false;
  const required = schemaRequired(schema);
  if (!required) return false;
  if (!required.every((key) => Object.hasOwn(value, key))) return false;
  if (schema.additionalProperties === false && Object.keys(value).some((key) => properties[key] === undefined)) return false;
  return Object.entries(properties).every(([key, propertySchema]) => value[key] === undefined || matchesSchema(propertySchema, value[key]));
}

function matchesArray(schema: Record<string, unknown>, value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const items = schema.items;
  if (!isRecord(items)) return false;
  return value.every((entry) => matchesSchema(items, entry));
}

function schemaProperties(schema: Record<string, unknown>): Record<string, Record<string, unknown>> | null {
  const properties = schema.properties;
  if (properties === undefined) return {};
  if (!isRecord(properties)) return null;
  const entries = Object.entries(properties);
  if (entries.some((entry) => !isRecord(entry[1]))) return null;
  return Object.fromEntries(entries as [string, Record<string, unknown>][]);
}

function schemaRequired(schema: Record<string, unknown>): string[] | null {
  const required = schema.required;
  if (required === undefined) return [];
  if (!Array.isArray(required)) return null;
  if (required.some((entry) => typeof entry !== "string")) return null;
  return required.filter((entry): entry is string => typeof entry === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

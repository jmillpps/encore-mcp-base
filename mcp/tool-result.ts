import { ServiceError } from "../shared/errors.ts";

export function assertCallToolResult(result: Record<string, unknown>): void {
  if (!Array.isArray(result.content) || !result.content.every(isContentBlock)) {
    throw new ServiceError("server_error", "invalid tool result", 500);
  }
  if (result.structuredContent !== undefined && !isRecord(result.structuredContent)) {
    throw new ServiceError("server_error", "invalid tool result", 500);
  }
  if (result.isError !== undefined && typeof result.isError !== "boolean") {
    throw new ServiceError("server_error", "invalid tool result", 500);
  }
  if (result._meta !== undefined && !isRecord(result._meta)) {
    throw new ServiceError("server_error", "invalid tool result", 500);
  }
}

function isContentBlock(value: unknown): boolean {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "text") return typeof value.text === "string";
  if (value.type === "image" || value.type === "audio") return typeof value.data === "string" && typeof value.mimeType === "string";
  if (value.type === "resource_link") return isResourceLink(value);
  if (value.type === "resource") return isEmbeddedResource(value);
  return false;
}

function isResourceLink(value: Record<string, unknown>): boolean {
  return (
    typeof value.name === "string" &&
    typeof value.uri === "string" &&
    optionalString(value.title) &&
    optionalString(value.description) &&
    optionalString(value.mimeType) &&
    optionalNumber(value.size) &&
    optionalRecord(value._meta)
  );
}

function isEmbeddedResource(value: Record<string, unknown>): boolean {
  if (!isRecord(value.resource)) return false;
  const resource = value.resource;
  return typeof resource.uri === "string" && optionalString(resource.mimeType) && optionalRecord(resource._meta) && (typeof resource.text === "string" || typeof resource.blob === "string");
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function optionalRecord(value: unknown): boolean {
  return value === undefined || isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { ServiceError } from "../shared/errors.ts";
import { isBase64, isBinaryContentMimeType, isIconSizes, isIconSource, isOptionalIconMimeType, isResourceUri } from "./media-validation.ts";

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
  if (value.type === "text") return isTextContent(value);
  if (value.type === "image" || value.type === "audio") return isBinaryContent(value);
  if (value.type === "resource_link") return isResourceLink(value);
  if (value.type === "resource") return isEmbeddedResource(value);
  return false;
}

function isTextContent(value: Record<string, unknown>): boolean {
  return hasOnlyKeys(value, ["type", "text", "annotations", "_meta"]) && typeof value.text === "string" && optionalAnnotations(value.annotations) && optionalRecord(value._meta);
}

function isBinaryContent(value: Record<string, unknown>): boolean {
  return (
    hasOnlyKeys(value, ["type", "data", "mimeType", "annotations", "_meta"]) &&
    isBase64(value.data) &&
    isBinaryContentMimeType(value.type, value.mimeType) &&
    optionalAnnotations(value.annotations) &&
    optionalRecord(value._meta)
  );
}

function isResourceLink(value: Record<string, unknown>): boolean {
  return (
    hasOnlyKeys(value, ["type", "icons", "name", "title", "uri", "description", "mimeType", "annotations", "size", "_meta"]) &&
    optionalIcons(value.icons) &&
    typeof value.name === "string" &&
    isResourceUri(value.uri) &&
    optionalString(value.title) &&
    optionalString(value.description) &&
    optionalString(value.mimeType) &&
    optionalSize(value.size) &&
    optionalAnnotations(value.annotations) &&
    optionalRecord(value._meta)
  );
}

function isEmbeddedResource(value: Record<string, unknown>): boolean {
  if (!hasOnlyKeys(value, ["type", "resource", "annotations", "_meta"])) return false;
  if (!isRecord(value.resource)) return false;
  const resource = value.resource;
  const hasText = typeof resource.text === "string";
  const hasBlob = typeof resource.blob === "string";
  if (hasText === hasBlob) return false;
  return (
    hasOnlyKeys(resource, hasText ? ["uri", "mimeType", "_meta", "text"] : ["uri", "mimeType", "_meta", "blob"]) &&
    isResourceUri(resource.uri) &&
    optionalString(resource.mimeType) &&
    optionalRecord(resource._meta) &&
    (hasText || isBase64(resource.blob)) &&
    optionalAnnotations(value.annotations) &&
    optionalRecord(value._meta)
  );
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function optionalSize(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}

function optionalRecord(value: unknown): boolean {
  return value === undefined || isRecord(value);
}

function optionalAnnotations(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || !hasOnlyKeys(value, ["audience", "priority", "lastModified"])) return false;
  if (value.audience !== undefined && (!Array.isArray(value.audience) || value.audience.some((entry) => entry !== "user" && entry !== "assistant"))) return false;
  if (value.priority !== undefined && (typeof value.priority !== "number" || !Number.isFinite(value.priority) || value.priority < 0 || value.priority > 1)) return false;
  return value.lastModified === undefined || typeof value.lastModified === "string";
}

function optionalIcons(value: unknown): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every(isIcon);
}

function isIcon(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ["src", "mimeType", "sizes", "theme"])) return false;
  return isIconSource(value.src) && isOptionalIconMimeType(value.mimeType) && optionalIconSizes(value.sizes) && optionalTheme(value.theme);
}

function optionalIconSizes(value: unknown): boolean {
  return value === undefined || isIconSizes(value);
}

function optionalTheme(value: unknown): boolean {
  return value === undefined || value === "light" || value === "dark";
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(record).every((key) => allowed.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

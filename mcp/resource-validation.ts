import { ServiceError } from "../shared/errors.ts";
import { isBase64, isIconSizes, isIconSource, isOptionalIconMimeType, isResourceUri } from "./media-validation.ts";
import type { McpResourceAnnotations, McpResourceContent, McpResourceDefinition, McpResourceTemplate } from "./resource-types.ts";

const scopePattern = /^[A-Za-z0-9:_./-]+$/;
const mimeTypePattern = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:;[ \t]*[A-Za-z0-9!#$&^_.+-]+=[A-Za-z0-9!#$&^_.+-]+)*$/;

export function assertResourceDefinitions(resources: McpResourceDefinition[], templates: McpResourceTemplate[]): void {
  const uris = new Set<string>();
  for (const resource of resources) {
    if (!isResourceDefinition(resource)) throw invalidResourceDescriptor();
    if (uris.has(resource.uri)) throw new ServiceError("server_error", "duplicate resource uri", 500);
    uris.add(resource.uri);
  }
  const templateUris = new Set<string>();
  for (const template of templates) {
    if (!isResourceTemplate(template)) throw invalidResourceDescriptor();
    if (templateUris.has(template.uriTemplate)) throw new ServiceError("server_error", "duplicate resource template uri", 500);
    templateUris.add(template.uriTemplate);
  }
}

export function assertResourceContents(contents: McpResourceContent[]): void {
  if (!Array.isArray(contents) || contents.length === 0 || !contents.every(isResourceContent)) {
    throw new ServiceError("server_error", "invalid resource content", 500);
  }
}

export function resourceDescriptor(resource: McpResourceDefinition): Record<string, unknown> {
  return {
    uri: resource.uri,
    name: resource.name,
    ...(resource.title ? { title: resource.title } : {}),
    ...(resource.description ? { description: resource.description } : {}),
    ...(resource.icons ? { icons: resource.icons } : {}),
    ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
    ...(resource.annotations ? { annotations: resource.annotations } : {}),
    ...(resource.size !== undefined ? { size: resource.size } : {}),
    ...(resource._meta ? { _meta: resource._meta } : {}),
  };
}

export function resourceTemplateDescriptor(template: McpResourceTemplate): Record<string, unknown> {
  return {
    uriTemplate: template.uriTemplate,
    name: template.name,
    ...(template.title ? { title: template.title } : {}),
    ...(template.description ? { description: template.description } : {}),
    ...(template.icons ? { icons: template.icons } : {}),
    ...(template.mimeType ? { mimeType: template.mimeType } : {}),
    ...(template.annotations ? { annotations: template.annotations } : {}),
    ...(template._meta ? { _meta: template._meta } : {}),
  };
}

function isResourceDefinition(value: unknown): value is McpResourceDefinition {
  if (!isRecord(value)) return false;
  const resource = value as unknown as McpResourceDefinition;
  return (
    hasOnlyKeys(resource as unknown as Record<string, unknown>, ["uri", "name", "title", "description", "icons", "mimeType", "annotations", "size", "_meta", "requiredScopes", "contents"]) &&
    isResourceUri(resource.uri) &&
    isName(resource.name) &&
    optionalString(resource.title) &&
    optionalString(resource.description) &&
    optionalIcons(resource.icons) &&
    optionalMimeType(resource.mimeType) &&
    optionalAnnotations(resource.annotations) &&
    optionalSize(resource.size) &&
    optionalRecord(resource._meta) &&
    isScopes(resource.requiredScopes) &&
    (Array.isArray(resource.contents) || typeof resource.contents === "function")
  );
}

function isResourceTemplate(value: unknown): value is McpResourceTemplate {
  if (!isRecord(value)) return false;
  const template = value as unknown as McpResourceTemplate;
  return (
    hasOnlyKeys(template as unknown as Record<string, unknown>, ["uriTemplate", "name", "title", "description", "icons", "mimeType", "annotations", "_meta"]) &&
    typeof template.uriTemplate === "string" &&
    template.uriTemplate.length > 0 &&
    template.uriTemplate.length <= 512 &&
    isName(template.name) &&
    optionalString(template.title) &&
    optionalString(template.description) &&
    optionalIcons(template.icons) &&
    optionalMimeType(template.mimeType) &&
    optionalAnnotations(template.annotations) &&
    optionalRecord(template._meta)
  );
}

function isResourceContent(value: unknown): value is McpResourceContent {
  if (!isRecord(value)) return false;
  const content = value as unknown as McpResourceContent;
  const hasText = typeof content.text === "string";
  const hasBlob = typeof content.blob === "string";
  return (
    hasOnlyKeys(content as unknown as Record<string, unknown>, ["uri", "mimeType", "text", "blob", "_meta"]) &&
    isResourceUri(content.uri) &&
    optionalMimeType(content.mimeType) &&
    hasText !== hasBlob &&
    (!hasBlob || isBase64(content.blob)) &&
    optionalRecord(content._meta)
  );
}

function optionalAnnotations(value: unknown): value is McpResourceAnnotations | undefined {
  if (value === undefined) return true;
  if (!isRecord(value) || !hasOnlyKeys(value, ["audience", "priority", "lastModified"])) return false;
  if (value.audience !== undefined && (!Array.isArray(value.audience) || value.audience.some((entry) => entry !== "user" && entry !== "assistant"))) return false;
  if (value.priority !== undefined && (typeof value.priority !== "number" || !Number.isFinite(value.priority) || value.priority < 0 || value.priority > 1)) return false;
  return value.lastModified === undefined || typeof value.lastModified === "string";
}

function optionalRecord(value: unknown): boolean {
  return value === undefined || (isRecord(value) && isJsonValue(value, 0));
}

function optionalIcons(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(isIcon));
}

function isIcon(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ["src", "mimeType", "sizes", "theme"])) return false;
  return isIconSource(value.src) && isOptionalIconMimeType(value.mimeType) && (value.sizes === undefined || isIconSizes(value.sizes)) && (value.theme === undefined || value.theme === "light" || value.theme === "dark");
}

function optionalMimeType(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.length <= 128 && mimeTypePattern.test(value));
}

function optionalSize(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}

function optionalString(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.length > 0 && value.length <= 512);
}

function isName(value: unknown): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function isScopes(value: unknown): boolean {
  return Array.isArray(value) && new Set(value).size === value.length && value.every((scope) => typeof scope === "string" && scopePattern.test(scope));
}

function isJsonValue(value: unknown, depth: number): boolean {
  if (depth > 16) return false;
  if (value === null || typeof value === "boolean" || typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 1024 && value.every((entry) => isJsonValue(entry, depth + 1));
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 128 && entries.every(([key, entry]) => key.length > 0 && key.length <= 128 && isJsonValue(entry, depth + 1));
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(record).every((key) => allowed.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidResourceDescriptor(): ServiceError {
  return new ServiceError("server_error", "invalid resource descriptor", 500);
}

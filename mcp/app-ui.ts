import { ServiceError } from "../shared/errors.ts";
import { isResourceUri } from "./media-validation.ts";
import { appUiResourceMimeType, type AppHtmlResourceOptions, type AppUiCsp, type McpResourceContent, type McpResourceDefinition, type ResourceContext, type ToolUiMetadata, type ToolUiVisibility } from "./resource-types.ts";

const visibilityValues = new Set(["model", "app"]);

export function appHtmlResource(options: AppHtmlResourceOptions): McpResourceDefinition {
  assertAppHtmlResourceOptions(options);
  const csp = options.widget?.csp;
  const standardUi = {
    ...uiRecord(options.meta?.ui),
    ...options.widget?.ui,
    ...(options.widget?.prefersBorder !== undefined ? { prefersBorder: options.widget.prefersBorder } : {}),
    ...(options.widget?.domain ? { domain: options.widget.domain } : {}),
    ...(csp ? { csp: standardCsp(csp) } : {}),
  };
  const meta = {
    ...options.meta,
    ...(Object.keys(standardUi).length > 0 ? { ui: standardUi } : {}),
    ...(options.widget?.description ? { "openai/widgetDescription": options.widget.description } : {}),
    ...(options.widget?.prefersBorder !== undefined ? { "openai/widgetPrefersBorder": options.widget.prefersBorder } : {}),
    ...(options.widget?.domain ? { "openai/widgetDomain": options.widget.domain } : {}),
    ...(csp ? { "openai/widgetCSP": openAiCsp(csp) } : {}),
  };
  return {
    uri: options.uri,
    name: options.name,
    ...(options.title ? { title: options.title } : {}),
    ...(options.description ? { description: options.description } : {}),
    ...(options.icons ? { icons: options.icons } : {}),
    ...(options.annotations ? { annotations: options.annotations } : {}),
    ...(options.size !== undefined ? { size: options.size } : {}),
    mimeType: appUiResourceMimeType,
    requiredScopes: options.requiredScopes ?? [],
    contents: appHtmlContents(options, meta),
  };
}

export function toolUiResource(resourceUri: string, options: { visibility?: ToolUiVisibility[]; openAiOutputTemplate?: string | false; widgetAccessible?: boolean; meta?: Record<string, unknown> } = {}): ToolUiMetadata {
  if (!isResourceUri(resourceUri)) throw invalidUiMetadata();
  if (options.openAiOutputTemplate !== undefined && options.openAiOutputTemplate !== false && !isResourceUri(options.openAiOutputTemplate)) throw invalidUiMetadata();
  if (options.visibility !== undefined && !isVisibility(options.visibility)) throw invalidUiMetadata();
  if (options.widgetAccessible !== undefined && typeof options.widgetAccessible !== "boolean") throw invalidUiMetadata();
  if (options.meta !== undefined && !isRecord(options.meta)) throw invalidUiMetadata();
  return {
    resourceUri,
    ...(options.visibility ? { visibility: [...options.visibility] } : {}),
    ...(options.openAiOutputTemplate !== undefined ? { openAiOutputTemplate: options.openAiOutputTemplate } : {}),
    ...(options.widgetAccessible !== undefined ? { widgetAccessible: options.widgetAccessible } : {}),
    ...(options.meta ? { meta: options.meta } : {}),
  };
}

export function assertToolUiMetadata(value: unknown): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw invalidUiMetadata();
  const ui = value as unknown as ToolUiMetadata;
  if (!isResourceUri(ui.resourceUri)) throw invalidUiMetadata();
  if (ui.visibility !== undefined && !isVisibility(ui.visibility)) throw invalidUiMetadata();
  if (ui.openAiOutputTemplate !== undefined && ui.openAiOutputTemplate !== false && !isResourceUri(ui.openAiOutputTemplate)) throw invalidUiMetadata();
  if (ui.widgetAccessible !== undefined && typeof ui.widgetAccessible !== "boolean") throw invalidUiMetadata();
  if (ui.meta !== undefined && !isRecord(ui.meta)) throw invalidUiMetadata();
}

export function toolUiDescriptorMeta(ui: ToolUiMetadata | undefined): Record<string, unknown> {
  const extra = ui?.meta ?? {};
  const uiMeta = {
    ...uiRecord(extra.ui),
    visibility: ui?.visibility ?? (ui ? ["model", "app"] : ["model"]),
    ...(ui ? { resourceUri: ui.resourceUri } : {}),
  };
  const outputTemplate = ui && ui.openAiOutputTemplate !== false ? ui.openAiOutputTemplate ?? ui.resourceUri : undefined;
  return {
    ...extra,
    ui: uiMeta,
    ...(outputTemplate ? { "openai/outputTemplate": outputTemplate } : {}),
    ...(ui?.widgetAccessible !== undefined ? { "openai/widgetAccessible": ui.widgetAccessible } : {}),
  };
}

function assertAppHtmlResourceOptions(options: AppHtmlResourceOptions): void {
  if (!isResourceUri(options.uri)) throw invalidResourceOptions();
  if (!options.name || typeof options.name !== "string") throw invalidResourceOptions();
  if (!isHtmlContent(options.html)) throw invalidResourceOptions();
  if (options.widget?.domain !== undefined && !isOrigin(options.widget.domain)) throw invalidResourceOptions();
  if (options.widget?.csp !== undefined && !isCsp(options.widget.csp)) throw invalidResourceOptions();
  if (options.meta !== undefined && !isRecord(options.meta)) throw invalidResourceOptions();
  if (options.widget?.ui !== undefined && !isRecord(options.widget.ui)) throw invalidResourceOptions();
}

function appHtmlContents(options: AppHtmlResourceOptions, meta: Record<string, unknown>): McpResourceDefinition["contents"] {
  const html = options.html;
  if (typeof html === "string") return [appHtmlContent(options.uri, html, meta)];
  return async (context: ResourceContext) => [appHtmlContent(options.uri, html(context), meta)];
}

function appHtmlContent(uri: string, html: string, meta: Record<string, unknown>): McpResourceContent {
  if (html.length === 0) throw invalidResourceOptions();
  return {
    uri,
    mimeType: appUiResourceMimeType,
    text: html,
    ...(Object.keys(meta).length > 0 ? { _meta: meta } : {}),
  };
}

function isHtmlContent(value: unknown): value is AppHtmlResourceOptions["html"] {
  return (typeof value === "string" && value.length > 0) || typeof value === "function";
}

function standardCsp(csp: AppUiCsp): Record<string, unknown> {
  return {
    connectDomains: [...csp.connectDomains],
    resourceDomains: [...csp.resourceDomains],
    ...(csp.frameDomains ? { frameDomains: [...csp.frameDomains] } : {}),
  };
}

function openAiCsp(csp: AppUiCsp): Record<string, unknown> {
  return {
    connect_domains: [...csp.connectDomains],
    resource_domains: [...csp.resourceDomains],
    ...(csp.frameDomains ? { frame_domains: [...csp.frameDomains] } : {}),
    ...(csp.redirectDomains ? { redirect_domains: [...csp.redirectDomains] } : {}),
  };
}

function isCsp(value: AppUiCsp): boolean {
  return (
    Array.isArray(value.connectDomains) &&
    Array.isArray(value.resourceDomains) &&
    value.connectDomains.every(isOriginPattern) &&
    value.resourceDomains.every(isOriginPattern) &&
    (value.frameDomains === undefined || (Array.isArray(value.frameDomains) && value.frameDomains.every(isOriginPattern))) &&
    (value.redirectDomains === undefined || (Array.isArray(value.redirectDomains) && value.redirectDomains.every(isOriginPattern)))
  );
}

function isOriginPattern(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 255) return false;
  if (/^https:\/\/\*\.[A-Za-z0-9.-]+(?::[1-9][0-9]{0,4})?$/.test(value)) return true;
  return isOrigin(value);
}

function isOrigin(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 255) return false;
  try {
    const url = new URL(value);
    if (url.pathname !== "/" || url.search || url.hash || !url.hostname) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
  } catch {
    return false;
  }
}

function isVisibility(value: unknown): value is ToolUiVisibility[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 2 && new Set(value).size === value.length && value.every((entry) => visibilityValues.has(String(entry)));
}

function uiRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidResourceOptions(): ServiceError {
  return new ServiceError("server_error", "invalid app ui resource", 500);
}

function invalidUiMetadata(): ServiceError {
  return new ServiceError("server_error", "invalid tool ui metadata", 500);
}

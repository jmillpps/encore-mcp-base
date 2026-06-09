import { ServiceError } from "../../shared/errors.ts";
import { appHtmlResource } from "../app-ui.ts";
import type { AppHtmlResourceWidget, AppUiCsp, McpResourceDefinition } from "../resource-types.ts";

export type WidgetAssetContentType = "application/javascript; charset=utf-8" | "text/css; charset=utf-8";
export type WidgetAssetKind = "script" | "style";

export interface WidgetAssetDefinition {
  kind: WidgetAssetKind;
  path: string;
  contentType: WidgetAssetContentType;
  body: string;
}

export interface WidgetDefinition {
  resourceUri: string;
  resource: McpResourceDefinition;
  assets: readonly WidgetAssetDefinition[];
}

export interface WidgetBaseDefinition {
  assets: readonly WidgetAssetDefinition[];
  widget?: AppHtmlResourceWidget;
}

export interface WidgetBaseOptions {
  assets?: readonly WidgetAssetDefinition[];
  widget?: AppHtmlResourceWidget;
}

export interface WidgetOptions {
  base?: WidgetBaseDefinition;
  resourceUri: string;
  name: string;
  title: string;
  description: string;
  markup: string;
  assets: readonly WidgetAssetDefinition[];
  requiredScopes?: string[];
  widget?: AppHtmlResourceWidget;
}

export function defineWidgetBase(options: WidgetBaseOptions): WidgetBaseDefinition {
  validateAssets(options.assets ?? []);
  return {
    assets: [...(options.assets ?? [])],
    widget: options.widget,
  };
}

export function defineWidget(options: WidgetOptions): WidgetDefinition {
  validateWidgetOptions(options);
  const assets = mergeAssets(options.base?.assets ?? [], options.assets);
  if (assets.length === 0) throw invalidWidget();
  const html = (assetOrigin = "") => `${options.markup.trim()}\n${assetTags(assets, assetOrigin)}`;
  return {
    resourceUri: options.resourceUri,
    assets,
    resource: appHtmlResource({
      uri: options.resourceUri,
      name: options.name,
      title: options.title,
      description: options.description,
      html: (context) => html(context.config.widgetDomain),
      requiredScopes: options.requiredScopes,
      widget: mergeWidget(options.base?.widget, options.widget),
    }),
  };
}

export function scriptAsset(path: string, body: string): WidgetAssetDefinition {
  return { kind: "script", path, contentType: "application/javascript; charset=utf-8", body };
}

export function styleAsset(path: string, body: string): WidgetAssetDefinition {
  return { kind: "style", path, contentType: "text/css; charset=utf-8", body };
}

function assetTags(assets: readonly WidgetAssetDefinition[], origin: string): string {
  return assets.map((asset) => assetTag(asset, origin)).join("\n");
}

function assetTag(asset: WidgetAssetDefinition, origin: string): string {
  const url = `${origin}${asset.path}`;
  if (asset.kind === "style") return `<link rel="stylesheet" href="${url}">`;
  return `<script src="${url}"></script>`;
}

function validateWidgetOptions(options: WidgetOptions): void {
  if (/<script\b/i.test(options.markup) || /<style\b/i.test(options.markup) || /\son[a-z]+\s*=/i.test(options.markup)) throw invalidWidget();
  validateAssets(options.assets);
}

function validateAssets(assets: readonly WidgetAssetDefinition[]): void {
  const paths = new Set<string>();
  for (const asset of assets) {
    if (!isAsset(asset) || !isAssetPath(asset.path) || asset.body.length === 0) throw invalidWidget();
    if (paths.has(asset.path)) throw invalidWidget();
    paths.add(asset.path);
  }
}

function mergeAssets(base: readonly WidgetAssetDefinition[], assets: readonly WidgetAssetDefinition[]): WidgetAssetDefinition[] {
  const merged = new Map<string, WidgetAssetDefinition>();
  for (const asset of [...base, ...assets]) {
    const existing = merged.get(asset.path);
    if (existing && (existing.kind !== asset.kind || existing.contentType !== asset.contentType || existing.body !== asset.body)) throw invalidWidget();
    merged.set(asset.path, asset);
  }
  return [...merged.values()];
}

function mergeWidget(base: AppHtmlResourceWidget | undefined, widget: AppHtmlResourceWidget | undefined): AppHtmlResourceWidget | undefined {
  if (!base && !widget) return undefined;
  return {
    ...base,
    ...widget,
    ...(base?.ui || widget?.ui ? { ui: { ...base?.ui, ...widget?.ui } } : {}),
    ...(base?.csp || widget?.csp ? { csp: mergeCsp(base?.csp, widget?.csp) } : {}),
  };
}

function mergeCsp(base: AppUiCsp | undefined, csp: AppUiCsp | undefined): AppUiCsp {
  return {
    connectDomains: unique([...(base?.connectDomains ?? []), ...(csp?.connectDomains ?? [])]),
    resourceDomains: unique([...(base?.resourceDomains ?? []), ...(csp?.resourceDomains ?? [])]),
    ...mergeOptionalCspList("frameDomains", base, csp),
    ...mergeOptionalCspList("redirectDomains", base, csp),
  };
}

function mergeOptionalCspList(key: "frameDomains" | "redirectDomains", base: AppUiCsp | undefined, csp: AppUiCsp | undefined): Partial<AppUiCsp> {
  const values = [...(base?.[key] ?? []), ...(csp?.[key] ?? [])];
  return values.length > 0 ? { [key]: unique(values) } : {};
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isAsset(asset: WidgetAssetDefinition): boolean {
  if (asset.kind === "script") return asset.contentType === "application/javascript; charset=utf-8" && asset.path.endsWith(".js");
  if (asset.kind === "style") return asset.contentType === "text/css; charset=utf-8" && asset.path.endsWith(".css");
  return false;
}

function isAssetPath(value: string): boolean {
  return /^\/app-ui\/[A-Za-z0-9._/-]+\.(?:css|js)$/.test(value) && !value.includes("//") && !value.includes("..");
}

function invalidWidget(): ServiceError {
  return new ServiceError("server_error", "invalid widget definition", 500);
}

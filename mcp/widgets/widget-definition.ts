import { ServiceError } from "../../shared/errors.ts";
import { appHtmlResource } from "../app-ui.ts";
import type { AppHtmlResourceWidget, McpResourceDefinition } from "../resource-types.ts";

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

export interface WidgetOptions {
  resourceUri: string;
  name: string;
  title: string;
  description: string;
  markup: string;
  assets: readonly WidgetAssetDefinition[];
  requiredScopes?: string[];
  widget: AppHtmlResourceWidget;
}

export function defineWidget(options: WidgetOptions): WidgetDefinition {
  validateWidgetOptions(options);
  const html = `${options.markup.trim()}\n${assetTags(options.assets)}`;
  return {
    resourceUri: options.resourceUri,
    assets: options.assets,
    resource: appHtmlResource({
      uri: options.resourceUri,
      name: options.name,
      title: options.title,
      description: options.description,
      html,
      requiredScopes: options.requiredScopes,
      widget: options.widget,
    }),
  };
}

export function scriptAsset(path: string, body: string): WidgetAssetDefinition {
  return { kind: "script", path, contentType: "application/javascript; charset=utf-8", body };
}

export function styleAsset(path: string, body: string): WidgetAssetDefinition {
  return { kind: "style", path, contentType: "text/css; charset=utf-8", body };
}

function assetTags(assets: readonly WidgetAssetDefinition[]): string {
  return assets.map(assetTag).join("\n");
}

function assetTag(asset: WidgetAssetDefinition): string {
  if (asset.kind === "style") return `<link rel="stylesheet" href="${asset.path}">`;
  return `<script src="${asset.path}"></script>`;
}

function validateWidgetOptions(options: WidgetOptions): void {
  if (options.assets.length === 0) throw invalidWidget();
  const paths = new Set<string>();
  for (const asset of options.assets) {
    if (!isAssetPath(asset.path) || asset.body.length === 0) throw invalidWidget();
    if (paths.has(asset.path)) throw invalidWidget();
    paths.add(asset.path);
  }
}

function isAssetPath(value: string): boolean {
  return /^\/app-ui\/[A-Za-z0-9._/-]+\.(?:css|js)$/.test(value) && !value.includes("//") && !value.includes("..");
}

function invalidWidget(): ServiceError {
  return new ServiceError("server_error", "invalid widget definition", 500);
}

import { healthStatusCardWidget } from "./health-status-card.ts";
import { profileSummaryCardWidget } from "./profile-summary-card.ts";
import { ServiceError } from "../../shared/errors.ts";
import type { McpResourceDefinition } from "../resource-types.ts";
import type { WidgetAssetDefinition, WidgetDefinition } from "./widget-definition.ts";

export {
  healthStatusCardScriptPath,
  healthStatusCardStylePath,
  healthStatusCardUri,
  healthStatusCardWidget,
} from "./health-status-card.ts";
export {
  profileSummaryCardScriptPath,
  profileSummaryCardStylePath,
  profileSummaryCardUri,
  profileSummaryCardWidget,
} from "./profile-summary-card.ts";
export {
  toolResultCardBase,
  toolResultCardBaseStylePath,
  widgetBridgeScriptPath,
} from "./tool-result-card.ts";

export const widgets: readonly WidgetDefinition[] = [healthStatusCardWidget, profileSummaryCardWidget];
export const widgetResources: McpResourceDefinition[] = widgets.map((widget) => widget.resource);
export const widgetAssets: readonly WidgetAssetDefinition[] = collectWidgetAssets(widgets);

export function widgetAssetByPath(path: string): WidgetAssetDefinition | undefined {
  return widgetAssets.find((asset) => asset.path === path);
}

function collectWidgetAssets(definitions: readonly WidgetDefinition[]): WidgetAssetDefinition[] {
  const assets = new Map<string, WidgetAssetDefinition>();
  for (const widget of definitions) {
    for (const asset of widget.assets) {
      const existing = assets.get(asset.path);
      if (existing && (existing.kind !== asset.kind || existing.contentType !== asset.contentType || existing.body !== asset.body)) throw invalidWidgetRegistry();
      assets.set(asset.path, asset);
    }
  }
  return [...assets.values()];
}

function invalidWidgetRegistry(): ServiceError {
  return new ServiceError("server_error", "invalid widget asset registry", 500);
}

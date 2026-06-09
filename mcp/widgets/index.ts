import { healthStatusCardWidget } from "./health-status-card.ts";
import { profileSummaryCardWidget } from "./profile-summary-card.ts";
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

export const widgets: readonly WidgetDefinition[] = [healthStatusCardWidget, profileSummaryCardWidget];
export const widgetResources: McpResourceDefinition[] = widgets.map((widget) => widget.resource);
export const widgetAssets: readonly WidgetAssetDefinition[] = widgets.flatMap((widget) => widget.assets);

export function widgetAssetByPath(path: string): WidgetAssetDefinition | undefined {
  return widgetAssets.find((asset) => asset.path === path);
}

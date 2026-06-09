import { defineWidget, scriptAsset, styleAsset } from "./widget-definition.ts";
import { toolResultCardBase } from "./tool-result-card-base.ts";
import { cardMarkup, rendererScript, themeCss } from "./tool-result-card-rendering.ts";
import { validateToolResultCardOptions } from "./tool-result-card-validation.ts";
import type { ToolResultCardWidgetOptions } from "./tool-result-card-types.ts";

export type {
  ToolResultCardTheme,
  ToolResultCardWidgetOptions,
  ToolResultField,
  ToolResultFieldFormat,
} from "./tool-result-card-types.ts";
export {
  toolResultCardBase,
  toolResultCardBaseStylePath,
  widgetBridgeScriptPath,
} from "./tool-result-card-base.ts";

export function defineToolResultCardWidget(options: ToolResultCardWidgetOptions) {
  validateToolResultCardOptions(options);
  return defineWidget({
    base: toolResultCardBase,
    resourceUri: options.resourceUri,
    name: options.name,
    title: options.title,
    description: options.description,
    requiredScopes: options.requiredScopes,
    markup: cardMarkup(options),
    assets: [
      styleAsset(options.stylePath, themeCss(options.theme)),
      scriptAsset(options.scriptPath, rendererScript(options)),
    ],
    widget: {
      description: options.widgetDescription,
      csp: {
        connectDomains: options.csp?.connectDomains ?? [],
        resourceDomains: options.csp?.resourceDomains ?? [],
        ...(options.csp?.frameDomains ? { frameDomains: options.csp.frameDomains } : {}),
        ...(options.csp?.redirectDomains ? { redirectDomains: options.csp.redirectDomains } : {}),
      },
    },
  });
}

import type { ServiceConfig } from "../shared/config.ts";
import { appUiResourceMimeType, type McpResourceContent } from "./resource-types.ts";

export function applyWidgetDomain(config: ServiceConfig, contents: McpResourceContent[]): McpResourceContent[] {
  return contents.map((content) => content.mimeType === appUiResourceMimeType ? withWidgetDomain(content, config.widgetDomain) : content);
}

function withWidgetDomain(content: McpResourceContent, domain: string): McpResourceContent {
  const meta = record(content._meta);
  const ui = record(meta.ui);
  return {
    ...content,
    _meta: {
      ...meta,
      ui: {
        ...ui,
        domain,
      },
      "openai/widgetDomain": domain,
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

import type { ServiceConfig } from "../../shared/config.ts";
import { appUiResourceMimeType, type McpResourceContent } from "../resource-types.ts";

export function applyWidgetRuntimeMetadata(config: ServiceConfig, contents: McpResourceContent[]): McpResourceContent[] {
  return contents.map((content) => content.mimeType === appUiResourceMimeType ? withRuntimeMetadata(content, config.widgetDomain) : content);
}

function withRuntimeMetadata(content: McpResourceContent, domain: string): McpResourceContent {
  const meta = record(content._meta);
  const ui = record(meta.ui);
  const csp = record(ui.csp);
  const openAiCsp = record(meta["openai/widgetCSP"]);
  return {
    ...content,
    _meta: {
      ...meta,
      ui: {
        ...ui,
        ...(Object.keys(csp).length > 0 ? { csp: withResourceDomain(csp, "resourceDomains", domain) } : {}),
        domain,
      },
      ...(Object.keys(openAiCsp).length > 0 ? { "openai/widgetCSP": withResourceDomain(openAiCsp, "resource_domains", domain) } : {}),
      "openai/widgetDomain": domain,
    },
  };
}

function withResourceDomain(csp: Record<string, unknown>, key: string, domain: string): Record<string, unknown> {
  return {
    ...csp,
    [key]: uniqueStrings([...strings(csp[key]), domain]),
  };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

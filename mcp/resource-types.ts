import type { ServiceConfig } from "../shared/config.ts";

export const appUiResourceMimeType = "text/html;profile=mcp-app";

export type ResourceAudience = "user" | "assistant";
export type ToolUiVisibility = "model" | "app";

export interface ResourceContext {
  config: ServiceConfig;
  authorization?: string;
  rateLimitSubject?: string;
}

export interface McpResourceAnnotations {
  audience?: ResourceAudience[];
  priority?: number;
  lastModified?: string;
}

export interface McpResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
  _meta?: Record<string, unknown>;
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  icons?: Record<string, unknown>[];
  mimeType?: string;
  annotations?: McpResourceAnnotations;
  size?: number;
  _meta?: Record<string, unknown>;
  requiredScopes: string[];
  contents: McpResourceContent[] | ((context: ResourceContext) => Promise<McpResourceContent[]>);
}

export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  title?: string;
  description?: string;
  icons?: Record<string, unknown>[];
  mimeType?: string;
  annotations?: McpResourceAnnotations;
  _meta?: Record<string, unknown>;
}

export interface ToolUiMetadata {
  resourceUri: string;
  visibility?: ToolUiVisibility[];
  openAiOutputTemplate?: string | false;
  widgetAccessible?: boolean;
  meta?: Record<string, unknown>;
}

export interface AppUiCsp {
  connectDomains: string[];
  resourceDomains: string[];
  frameDomains?: string[];
  redirectDomains?: string[];
}

export interface AppHtmlResourceOptions {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  html: string;
  icons?: Record<string, unknown>[];
  annotations?: McpResourceAnnotations;
  size?: number;
  requiredScopes?: string[];
  widget?: AppHtmlResourceWidget;
  meta?: Record<string, unknown>;
}

export interface AppHtmlResourceWidget {
  description?: string;
  prefersBorder?: boolean;
  domain?: string;
  csp?: AppUiCsp;
  ui?: Record<string, unknown>;
}

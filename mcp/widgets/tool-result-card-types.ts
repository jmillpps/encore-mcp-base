import type { AppUiCsp } from "../resource-types.ts";

export type ToolResultFieldFormat = "text" | "verified";

export interface ToolResultField {
  label: string;
  id: string;
  path: string;
  fallback: string;
  format?: ToolResultFieldFormat;
}

export interface ToolResultCardTheme {
  pageBackground: string;
  cardBackground: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  accentTextColor: string;
}

export interface ToolResultCardWidgetOptions {
  resourceUri: string;
  name: string;
  title: string;
  description: string;
  widgetDescription: string;
  stylePath: string;
  scriptPath: string;
  requiredScopes?: string[];
  csp?: Partial<AppUiCsp>;
  theme: ToolResultCardTheme;
  header: {
    eyebrow?: string;
    title: string;
    titlePath?: string;
    titleFallback?: string;
    subtitle?: string;
    subtitlePath?: string;
    subtitleFallback?: string;
    avatarPath?: string;
    avatarFallback?: string;
  };
  status?: {
    path: string;
    fallback: string;
    okValue: string;
    okSummary: string;
    waitingSummary: string;
  };
  fields: readonly ToolResultField[];
}

import type { ServiceConfig } from "../shared/config.ts";

export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  annotations: Record<string, unknown>;
  requiredScopes: string[];
  run: (context: ToolContext, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface ToolContext {
  config: ServiceConfig;
  authorization?: string;
  rateLimitSubject?: string;
}

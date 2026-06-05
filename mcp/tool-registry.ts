import { enforceRateLimit } from "../auth/rate-limit.ts";
import { ServiceError } from "../shared/errors.ts";
import { authChallengeResult } from "./auth-challenge.ts";
import { assertMatchesSchema } from "./schema-validation.ts";
import { authSessionTool } from "./tools/auth-session.ts";
import { healthCheckTool } from "./tools/health-check.ts";
import { identityProfileTool } from "./tools/identity-profile.ts";
import type { McpTool, ToolContext } from "./tool-types.ts";

export type { McpTool, ToolContext } from "./tool-types.ts";

export const tools: McpTool[] = [healthCheckTool, identityProfileTool, authSessionTool];

export function listTools(): Record<string, unknown> {
  return { tools: tools.map(({ run: _run, requiredScopes: _requiredScopes, ...tool }) => tool) };
}

export async function callTool(context: ToolContext, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new ServiceError("not_found", "tool not found", 404);
  assertToolArguments(tool, args);
  await enforceRateLimit(context.config, "mcp-tool", context.rateLimitSubject ?? "unknown");
  try {
    const result = await tool.run(context, args);
    if (result.isError !== true) assertMatchesSchema(tool.outputSchema, result.structuredContent);
    return result;
  } catch (error) {
    if (error instanceof ServiceError && (error.status === 401 || error.status === 403)) {
      return authChallengeResult(context.config, tool.requiredScopes);
    }
    throw error;
  }
}

function assertToolArguments(tool: McpTool, args: Record<string, unknown>): void {
  if (tool.inputSchema.type !== "object" || tool.inputSchema.additionalProperties !== false) return;
  const properties = tool.inputSchema.properties;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) throw new ServiceError("bad_request", "invalid tool schema", 400);
  const allowed = new Set(Object.keys(properties));
  if (Object.keys(args).some((key) => !allowed.has(key))) throw new ServiceError("bad_request", "invalid tool arguments", 400);
}

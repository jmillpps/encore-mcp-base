import { enforceRateLimit } from "../auth/rate-limit.ts";
import { ServiceError } from "../shared/errors.ts";
import { authChallengeResult } from "./auth-challenge.ts";
import { McpProtocolError } from "./protocol-error.ts";
import { assertMatchesSchema, matchesSchema } from "./schema-validation.ts";
import { authSessionTool } from "./tools/auth-session.ts";
import { healthCheckTool } from "./tools/health-check.ts";
import { identityProfileTool } from "./tools/identity-profile.ts";
import { toolExecution } from "./tool-execution.ts";
import { assertCallToolResult } from "./tool-result.ts";
import { toolSecuritySchemes } from "./tool-security.ts";
import type { McpTool, ToolContext } from "./tool-types.ts";

export type { McpTool, ToolContext } from "./tool-types.ts";

export const tools: McpTool[] = [healthCheckTool, identityProfileTool, authSessionTool];

const scopePattern = /^[A-Za-z0-9:_./-]+$/;

export function listTools(): Record<string, unknown> {
  assertToolDefinitions();
  return { tools: tools.map(toolDescriptor) };
}

export async function callTool(context: ToolContext, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  assertToolDefinitions();
  await enforceRateLimit(context.config, "mcp-tool", context.rateLimitSubject ?? "unknown");
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new McpProtocolError(-32602, `Unknown tool: ${name}`);
  const argumentError = toolArgumentError(tool, args);
  if (argumentError) return toolExecutionError(argumentError);
  try {
    const result = await tool.run(context, args);
    assertCallToolResult(result);
    if (result.isError !== true) assertMatchesSchema(tool.outputSchema, result.structuredContent);
    return result;
  } catch (error) {
    if (error instanceof ServiceError && (error.status === 401 || error.status === 403)) {
      const result = authChallengeResult(context.config, tool.requiredScopes, error);
      assertCallToolResult(result);
      return result;
    }
    throw error;
  }
}

function assertToolDefinitions(): void {
  const names = new Set<string>();
  for (const tool of tools) {
    assertToolDescriptor(tool);
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)) throw new ServiceError("server_error", "invalid tool name", 500);
    if (names.has(tool.name)) throw new ServiceError("server_error", "duplicate tool name", 500);
    names.add(tool.name);
  }
}

function assertToolDescriptor(tool: McpTool): void {
  if (typeof tool.title !== "string" || tool.title.length === 0) throw invalidToolDescriptor();
  if (typeof tool.description !== "string" || tool.description.length === 0) throw invalidToolDescriptor();
  if (!isObjectSchema(tool.inputSchema)) throw invalidToolDescriptor();
  if (!isObjectSchema(tool.outputSchema)) throw invalidToolDescriptor();
  if (!isToolAnnotations(tool.annotations)) throw invalidToolDescriptor();
  if (!Array.isArray(tool.requiredScopes) || tool.requiredScopes.some((scope) => typeof scope !== "string" || !scopePattern.test(scope))) throw invalidToolDescriptor();
  if (new Set(tool.requiredScopes).size !== tool.requiredScopes.length) throw invalidToolDescriptor();
  if (typeof tool.run !== "function") throw invalidToolDescriptor();
}

function toolDescriptor(tool: McpTool): Record<string, unknown> {
  const securitySchemes = toolSecuritySchemes(tool.requiredScopes);
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execution: toolExecution(),
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
    securitySchemes,
    _meta: { securitySchemes },
  };
}

function toolArgumentError(tool: McpTool, args: Record<string, unknown>): string | undefined {
  if (tool.inputSchema.type !== "object" || tool.inputSchema.additionalProperties !== false) {
    return matchesSchema(tool.inputSchema, args) ? undefined : "Invalid tool arguments.";
  }
  const properties = tool.inputSchema.properties;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) throw new ServiceError("server_error", "invalid tool schema", 500);
  const allowed = new Set(Object.keys(properties));
  const unexpected = Object.keys(args).find((key) => !allowed.has(key));
  if (unexpected) return `Invalid tool arguments: unsupported argument "${unexpected}".`;
  return matchesSchema(tool.inputSchema, args) ? undefined : "Invalid tool arguments.";
}

function toolExecutionError(message: string): Record<string, unknown> {
  return { content: [{ type: "text", text: message }], isError: true };
}

function isObjectSchema(schema: unknown): schema is Record<string, unknown> {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) return false;
  const record = schema as Record<string, unknown>;
  if (record.$schema !== undefined && typeof record.$schema !== "string") return false;
  if (record.type !== "object") return false;
  if (record.properties !== undefined && !isSchemaProperties(record.properties)) return false;
  if (record.required !== undefined && (!Array.isArray(record.required) || record.required.some((entry) => typeof entry !== "string"))) return false;
  if (record.additionalProperties !== undefined && typeof record.additionalProperties !== "boolean") return false;
  return true;
}

function isSchemaProperties(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry));
}

function isToolAnnotations(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["title", "readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"].includes(key))) return false;
  if (record.title !== undefined && typeof record.title !== "string") return false;
  for (const key of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) {
    if (record[key] !== undefined && typeof record[key] !== "boolean") return false;
  }
  return true;
}

function invalidToolDescriptor(): ServiceError {
  return new ServiceError("server_error", "invalid tool descriptor", 500);
}

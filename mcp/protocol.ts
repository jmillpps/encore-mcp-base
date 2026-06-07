import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { asRecord } from "../shared/json.ts";
import { extractWwwAuthenticate } from "./auth-challenge.ts";
import { callTool, listTools } from "./tool-registry.ts";
import { initializeClientId, initializeResult } from "./lifecycle.ts";
import { isJsonRpcResponse, jsonRpcError, jsonRpcSuccess, parseJsonRpc, type JsonRpcRequest } from "./json-rpc.ts";
import { McpProtocolError } from "./protocol-error.ts";

export interface McpContext {
  config: ServiceConfig;
  authorization?: string;
  rateLimitSubject?: string;
  sessionInitialized?: boolean;
}

export interface McpResult {
  status: number;
  body?: Record<string, unknown>;
  initialized?: boolean;
  clientId?: string;
  wwwAuthenticate?: string[];
}

export async function handleMcpJson(context: McpContext, input: unknown): Promise<McpResult> {
  let request: JsonRpcRequest;
  try {
    if (isJsonRpcResponse(input)) return { status: 202 };
    request = parseJsonRpc(input);
  } catch (error) {
    if (error instanceof ServiceError) return { status: error.status, body: jsonRpcError(undefined, -32600, error.message) };
    throw error;
  }
  if (context.sessionInitialized === false && !["initialize", "ping", "notifications/initialized"].includes(request.method)) {
    return { status: request.id === undefined ? 400 : 200, body: jsonRpcError(request.id, -32002, "session is not initialized") };
  }
  if (request.id === undefined) return handleNotification(request);
  try {
    const result = await dispatch(context, request);
    return {
      status: 200,
      body: jsonRpcSuccess(request.id, result),
      initialized: request.method === "initialize",
      ...(request.method === "initialize" ? { clientId: initializeClientId(request.params) } : {}),
      wwwAuthenticate: extractWwwAuthenticate(result),
    };
  } catch (error) {
    if (error instanceof McpProtocolError) return { status: 200, body: jsonRpcError(request.id, error.rpcCode, error.message) };
    if (error instanceof ServiceError) return { status: error.status, body: jsonRpcError(request.id, -32000, error.message) };
    return { status: 500, body: jsonRpcError(request.id, -32603, "internal error") };
  }
}

function handleNotification(request: JsonRpcRequest): McpResult {
  if (!request.method.startsWith("notifications/")) {
    return { status: 400, body: jsonRpcError(undefined, -32600, "request method requires id") };
  }
  if (request.method === "notifications/initialized") return { status: 202 };
  return { status: 202 };
}

async function dispatch(context: McpContext, request: JsonRpcRequest): Promise<unknown> {
  if (request.method === "initialize") return initializeResult(request.params);
  if (request.method === "ping") return {};
  if (request.method === "tools/list") {
    validateListParams(request.params);
    return listTools();
  }
  if (request.method === "tools/call") {
    const { name, args } = toolCallParams(request.params);
    return callTool(context, name, args);
  }
  throw new McpProtocolError(-32601, "method not found");
}

function validateListParams(params: unknown): void {
  if (params === undefined) return;
  if (typeof params !== "object" || params === null || Array.isArray(params)) throw new McpProtocolError(-32602, "tools/list params must be an object");
  const record = params as Record<string, unknown>;
  if (record._meta !== undefined && (typeof record._meta !== "object" || record._meta === null || Array.isArray(record._meta))) {
    throw new McpProtocolError(-32602, "tools/list _meta must be an object");
  }
  if (record.cursor === undefined) return;
  if (typeof record.cursor !== "string") throw new McpProtocolError(-32602, "tools/list cursor must be a string");
  throw new McpProtocolError(-32602, "invalid cursor");
}

function toolCallParams(params: unknown): { name: string; args: Record<string, unknown> } {
  if (typeof params !== "object" || params === null || Array.isArray(params)) throw new McpProtocolError(-32602, "tools/call params must be an object");
  const record = params as Record<string, unknown>;
  if (record._meta !== undefined && (typeof record._meta !== "object" || record._meta === null || Array.isArray(record._meta))) {
    throw new McpProtocolError(-32602, "tools/call _meta must be an object");
  }
  if (record.task !== undefined) throw new McpProtocolError(-32602, "task-augmented tool calls are unsupported");
  if (typeof record.name !== "string" || record.name.length === 0) throw new McpProtocolError(-32602, "tools/call name must be a string");
  const args = record.arguments;
  if (args === undefined) return { name: record.name, args: {} };
  if (typeof args !== "object" || args === null || Array.isArray(args)) throw new McpProtocolError(-32602, "tools/call arguments must be an object");
  return { name: record.name, args: args as Record<string, unknown> };
}

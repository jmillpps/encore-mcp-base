import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { extractWwwAuthenticate, McpAuthChallengeError, wwwAuthenticate } from "./auth-challenge.ts";
import { isResourceUri } from "./media-validation.ts";
import { listResources, listResourceTemplates, readResource } from "./resource-registry.ts";
import { callTool, listTools } from "./tool-registry.ts";
import { initializeClientId, initializeResult } from "./lifecycle.ts";
import { isJsonRpcResponse, jsonRpcError, jsonRpcSuccess, parseJsonRpc, type JsonRpcId, type JsonRpcRequest } from "./json-rpc.ts";
import { handleNotification } from "./notifications.ts";
import { McpProtocolError } from "./protocol-error.ts";
import { optionalMethodParams, requiredMethodParams } from "./request-params.ts";

export interface McpContext {
  config: ServiceConfig;
  authorization?: string;
  rateLimitSubject?: string;
  sessionInitialized?: boolean;
  reserveRequestId?: (id: JsonRpcId) => Promise<void>;
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
  try {
    if (request.id !== undefined) await context.reserveRequestId?.(request.id);
    if (context.sessionInitialized === false && !["initialize", "ping", "notifications/initialized"].includes(request.method)) {
      return { status: request.id === undefined ? 400 : 200, body: jsonRpcError(request.id, -32002, "session is not initialized") };
    }
    if (request.id === undefined) return handleNotification(request);
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
    if (error instanceof McpAuthChallengeError) {
      return {
        status: 200,
        body: jsonRpcError(request.id, -32000, error.message),
        wwwAuthenticate: [wwwAuthenticate(context.config, error.scopes, error)],
      };
    }
    if (error instanceof ServiceError) return { status: error.status, body: jsonRpcError(request.id, -32000, error.message) };
    return { status: 500, body: jsonRpcError(request.id, -32603, "internal error") };
  }
}

async function dispatch(context: McpContext, request: JsonRpcRequest): Promise<unknown> {
  if (request.method === "initialize") return initializeResult(context.config, request.params);
  if (request.method === "ping") {
    optionalMethodParams(request.params, "ping", ["_meta"]);
    return {};
  }
  if (request.method === "tools/list") {
    return listTools(request.params, context.config.mcpListPageSize);
  }
  if (request.method === "tools/call") {
    const { name, args } = toolCallParams(request.params);
    return callTool(context, name, args);
  }
  if (request.method === "resources/list") {
    return listResources(request.params, context.config.mcpListPageSize);
  }
  if (request.method === "resources/templates/list") {
    return listResourceTemplates(request.params, context.config.mcpListPageSize);
  }
  if (request.method === "resources/read") {
    const uri = resourceReadParams(request.params);
    return readResource(context, uri);
  }
  throw new McpProtocolError(-32601, "method not found");
}

function toolCallParams(params: unknown): { name: string; args: Record<string, unknown> } {
  const record = requiredMethodParams(params, "tools/call", ["_meta", "task", "name", "arguments"]);
  if (typeof record.name !== "string" || record.name.length === 0) throw new McpProtocolError(-32602, "tools/call name must be a string");
  const args = record.arguments;
  if (args === undefined) return { name: record.name, args: {} };
  if (typeof args !== "object" || args === null || Array.isArray(args)) throw new McpProtocolError(-32602, "tools/call arguments must be an object");
  return { name: record.name, args: args as Record<string, unknown> };
}

function resourceReadParams(params: unknown): string {
  const record = requiredMethodParams(params, "resources/read", ["_meta", "uri"]);
  if (!isResourceUri(record.uri)) throw new McpProtocolError(-32602, "resources/read uri must be a valid resource URI");
  return record.uri;
}

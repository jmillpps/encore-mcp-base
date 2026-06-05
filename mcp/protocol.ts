import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { asRecord } from "../shared/json.ts";
import { extractWwwAuthenticate } from "./auth-challenge.ts";
import { callTool, listTools } from "./tool-registry.ts";
import { initializeResult } from "./lifecycle.ts";
import { jsonRpcError, jsonRpcSuccess, methodParamObject, methodParamString, parseJsonRpc, type JsonRpcRequest } from "./json-rpc.ts";

export interface McpContext {
  config: ServiceConfig;
  authorization?: string;
  rateLimitSubject?: string;
}

export interface McpResult {
  status: number;
  body?: Record<string, unknown>;
  initialized?: boolean;
  wwwAuthenticate?: string[];
}

export async function handleMcpJson(context: McpContext, input: unknown): Promise<McpResult> {
  let request: JsonRpcRequest;
  try {
    request = parseJsonRpc(input);
  } catch (error) {
    if (error instanceof ServiceError) return { status: error.status, body: jsonRpcError(undefined, -32600, error.message) };
    throw error;
  }
  if (request.id === undefined) return handleNotification(request);
  try {
    const result = await dispatch(context, request);
    return { status: 200, body: jsonRpcSuccess(request.id, result), initialized: request.method === "initialize", wwwAuthenticate: extractWwwAuthenticate(result) };
  } catch (error) {
    if (error instanceof McpProtocolError) return { status: 200, body: jsonRpcError(request.id, error.rpcCode, error.message) };
    if (error instanceof ServiceError) return { status: error.status, body: jsonRpcError(request.id, -32000, error.message) };
    return { status: 500, body: jsonRpcError(request.id, -32603, "internal error") };
  }
}

function handleNotification(request: JsonRpcRequest): McpResult {
  if (request.method === "notifications/initialized") return { status: 202 };
  return { status: 202 };
}

async function dispatch(context: McpContext, request: JsonRpcRequest): Promise<unknown> {
  if (request.method === "initialize") return initializeResult(request.params);
  if (request.method === "ping") return {};
  if (request.method === "tools/list") return listTools();
  if (request.method === "tools/call") {
    const name = methodParamString(request, "name");
    const args = methodParamObject(request, "arguments");
    return callTool(context, name, args);
  }
  asRecord(request.params ?? {}, "params");
  throw new McpProtocolError(-32601, "method not found");
}

class McpProtocolError extends Error {
  readonly rpcCode: number;

  constructor(rpcCode: number, message: string) {
    super(message);
    this.rpcCode = rpcCode;
  }
}

import type { IncomingMessage } from "node:http";
import { ServiceError } from "../shared/errors.ts";
import { readBody } from "../shared/http.ts";
import { jsonRpcError } from "./json-rpc.ts";

export class McpBodyResult {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {}
}

export async function readMcpJsonBody(req: IncomingMessage): Promise<unknown | McpBodyResult> {
  try {
    return JSON.parse(await readBody(req));
  } catch (error) {
    if (error instanceof ServiceError) return new McpBodyResult(error.status, jsonRpcError(undefined, -32600, error.message));
    return new McpBodyResult(400, jsonRpcError(undefined, -32700, "parse error"));
  }
}

export function isMcpBodyResult(value: unknown): value is McpBodyResult {
  return value instanceof McpBodyResult;
}

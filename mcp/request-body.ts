import type { IncomingMessage } from "node:http";
import { ServiceError } from "../shared/errors.ts";
import { readBody } from "../shared/http.ts";
import { jsonRpcError } from "./json-rpc.ts";

export interface McpBodyResult {
  status: number;
  body: Record<string, unknown>;
}

export async function readMcpJsonBody(req: IncomingMessage): Promise<unknown | McpBodyResult> {
  try {
    return JSON.parse(await readBody(req));
  } catch (error) {
    if (error instanceof ServiceError) return { status: error.status, body: jsonRpcError(undefined, -32600, error.message) };
    return { status: 400, body: jsonRpcError(undefined, -32700, "parse error") };
  }
}

export function isMcpBodyResult(value: unknown): value is McpBodyResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as McpBodyResult;
  return typeof record.status === "number" && typeof record.body === "object" && record.body !== null;
}

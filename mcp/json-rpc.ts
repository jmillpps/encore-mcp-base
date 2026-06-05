import { ServiceError } from "../shared/errors.ts";
import { asRecord, optionalString, requiredString } from "../shared/json.ts";

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export function parseJsonRpc(value: unknown): JsonRpcRequest {
  const record = asRecord(value, "json-rpc");
  if (record.jsonrpc !== "2.0") throw new ServiceError("bad_request", "invalid json-rpc version", 400);
  const method = requiredString(record, "method");
  const id = record.id;
  if (id !== undefined && typeof id !== "string" && typeof id !== "number" && id !== null) {
    throw new ServiceError("bad_request", "invalid json-rpc id", 400);
  }
  return { jsonrpc: "2.0", method, ...(id !== undefined ? { id } : {}), ...(record.params !== undefined ? { params: record.params } : {}) };
}

export function jsonRpcSuccess(id: JsonRpcId | undefined, result: unknown): Record<string, unknown> {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

export function jsonRpcError(id: JsonRpcId | undefined, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export function methodParamString(request: JsonRpcRequest, key: string): string {
  return requiredString(asRecord(request.params, "params"), key);
}

export function methodParamObject(request: JsonRpcRequest, key: string): Record<string, unknown> {
  const value = asRecord(request.params, "params")[key];
  return value === undefined ? {} : asRecord(value, key);
}

export function optionalParamString(request: JsonRpcRequest, key: string): string | undefined {
  return optionalString(asRecord(request.params, "params"), key);
}

import { ServiceError } from "../shared/errors.ts";
import { asRecord, optionalString, requiredString } from "../shared/json.ts";

export type JsonRpcId = string | number;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export function isJsonRpcResponse(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.method !== undefined || record.jsonrpc !== "2.0") return false;
  const hasResult = Object.hasOwn(record, "result");
  const hasError = Object.hasOwn(record, "error");
  if (!hasResult && !hasError) return false;
  assertOnlyKeys(record, hasResult ? ["jsonrpc", "id", "result"] : ["jsonrpc", "id", "error"], "invalid json-rpc response");
  if (hasResult === hasError) throw new ServiceError("bad_request", "invalid json-rpc response", 400);
  if (hasResult && !Object.hasOwn(record, "id")) throw new ServiceError("bad_request", "invalid json-rpc response", 400);
  if (Object.hasOwn(record, "id")) validateJsonRpcId(record.id);
  if (hasResult) validateJsonRpcResult(record.result);
  if (hasError) validateJsonRpcError(record.error);
  return true;
}

export function parseJsonRpc(value: unknown): JsonRpcRequest {
  const record = asRecord(value, "json-rpc");
  assertOnlyKeys(record, ["jsonrpc", "id", "method", "params"], "invalid json-rpc message");
  if (record.jsonrpc !== "2.0") throw new ServiceError("bad_request", "invalid json-rpc version", 400);
  if (Object.hasOwn(record, "result") || Object.hasOwn(record, "error")) throw new ServiceError("bad_request", "invalid json-rpc message", 400);
  const method = requiredString(record, "method");
  const id = record.id;
  if (id !== undefined) validateJsonRpcId(id);
  const request: JsonRpcRequest = { jsonrpc: "2.0", method };
  if (id !== undefined) request.id = id;
  if (record.params !== undefined) request.params = jsonRpcParams(record.params);
  return request;
}

export function jsonRpcSuccess(id: JsonRpcId, result: unknown): Record<string, unknown> {
  return { jsonrpc: "2.0", id, result };
}

export function jsonRpcError(id: JsonRpcId | undefined, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: "2.0", ...(id !== undefined ? { id } : {}), error: { code, message } };
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

function validateJsonRpcError(value: unknown): void {
  const record = asRecord(value, "error");
  assertOnlyKeys(record, ["code", "message", "data"], "invalid json-rpc error");
  if (!Number.isInteger(record.code)) throw new ServiceError("bad_request", "invalid json-rpc error", 400);
  if (typeof record.message !== "string") throw new ServiceError("bad_request", "invalid json-rpc error", 400);
}

function validateJsonRpcResult(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ServiceError("bad_request", "invalid json-rpc response", 400);
}

function jsonRpcParams(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ServiceError("bad_request", "invalid json-rpc params", 400);
  return value as Record<string, unknown>;
}

function validateJsonRpcId(value: unknown): asserts value is JsonRpcId {
  if (typeof value !== "string" && typeof value !== "number") throw new ServiceError("bad_request", "invalid json-rpc id", 400);
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new ServiceError("bad_request", "invalid json-rpc id", 400);
}

function assertOnlyKeys(record: Record<string, unknown>, allowed: readonly string[], message: string): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) throw new ServiceError("bad_request", message, 400);
}

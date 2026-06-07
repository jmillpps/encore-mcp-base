import { requestMetaError } from "./client-meta.ts";
import { McpProtocolError } from "./protocol-error.ts";

export function optionalMethodParams(params: unknown, method: string, allowedKeys: readonly string[]): Record<string, unknown> | undefined {
  if (params === undefined) return undefined;
  return validateMethodParams(params, method, allowedKeys);
}

export function requiredMethodParams(params: unknown, method: string, allowedKeys: readonly string[]): Record<string, unknown> {
  if (params === undefined) throw new McpProtocolError(-32602, `${method} params must be an object`);
  return validateMethodParams(params, method, allowedKeys);
}

function validateMethodParams(params: unknown, method: string, allowedKeys: readonly string[]): Record<string, unknown> {
  if (typeof params !== "object" || params === null || Array.isArray(params)) throw new McpProtocolError(-32602, `${method} params must be an object`);
  const record = params as Record<string, unknown>;
  validateKeys(record, method, allowedKeys);
  const metaError = requestMetaError(record._meta, method);
  if (metaError) throw new McpProtocolError(-32602, metaError);
  return record;
}

function validateKeys(record: Record<string, unknown>, method: string, allowedKeys: readonly string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) throw new McpProtocolError(-32602, `${method} params contain unsupported fields`);
  }
}

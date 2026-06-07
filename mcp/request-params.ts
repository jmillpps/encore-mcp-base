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
  validateMeta(record._meta, method);
  return record;
}

function validateKeys(record: Record<string, unknown>, method: string, allowedKeys: readonly string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) throw new McpProtocolError(-32602, `${method} params contain unsupported fields`);
  }
}

function validateMeta(value: unknown, method: string): void {
  if (value === undefined) return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new McpProtocolError(-32602, `${method} _meta must be an object`);
  const progressToken = (value as Record<string, unknown>).progressToken;
  if (progressToken === undefined) return;
  if (typeof progressToken === "string") return;
  if (typeof progressToken === "number" && Number.isFinite(progressToken)) return;
  throw new McpProtocolError(-32602, `${method} progressToken must be a string or finite number`);
}

const labelPattern = /^[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const namePattern = /^(?:[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)?$/;

export function requestMetaError(value: unknown, context: string): string | undefined {
  const meta = validateClientMeta(value, context);
  if (typeof meta === "string") return meta;
  if (meta === undefined) return undefined;
  const progressToken = meta.progressToken;
  if (progressToken === undefined) return undefined;
  if (typeof progressToken === "string") return undefined;
  if (typeof progressToken === "number" && Number.isFinite(progressToken)) return undefined;
  return `${context} progressToken must be a string or finite number`;
}

export function notificationMetaError(value: unknown, context: string): string | undefined {
  const meta = validateClientMeta(value, context);
  return typeof meta === "string" ? meta : undefined;
}

function validateClientMeta(value: unknown, context: string): Record<string, unknown> | string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return `${context} _meta must be an object`;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!validMetaKey(key)) return `${context} _meta key has invalid format`;
    if (reservedMcpPrefix(key)) return `${context} _meta key uses reserved MCP prefix`;
  }
  return record;
}

function validMetaKey(key: string): boolean {
  const slash = key.indexOf("/");
  if (slash === -1) return namePattern.test(key);
  const prefix = key.slice(0, slash);
  const name = key.slice(slash + 1);
  return validPrefix(prefix) && namePattern.test(name);
}

function validPrefix(prefix: string): boolean {
  if (prefix.length === 0) return false;
  return prefix.split(".").every((label) => labelPattern.test(label));
}

function reservedMcpPrefix(key: string): boolean {
  const slash = key.indexOf("/");
  if (slash === -1) return false;
  const labels = key.slice(0, slash).toLowerCase().split(".");
  return labels[1] === "modelcontextprotocol" || labels[1] === "mcp";
}

import { jsonRpcError, type JsonRpcRequest } from "./json-rpc.ts";

interface NotificationResult {
  status: number;
  body?: Record<string, unknown>;
}

class InvalidNotification extends Error {}

export function handleNotification(request: JsonRpcRequest): NotificationResult {
  try {
    if (!request.method.startsWith("notifications/")) return invalidNotification("request method requires id");
    if (request.method === "notifications/initialized") {
      validateNotificationParams(request.params);
      return { status: 202 };
    }
    if (request.method === "notifications/cancelled") {
      validateCancelledParams(request.params);
      return { status: 202 };
    }
    if (request.method === "notifications/roots/list_changed") {
      validateNotificationParams(request.params);
      return { status: 202 };
    }
    return invalidNotification("unsupported notification method");
  } catch (error) {
    if (error instanceof InvalidNotification) return invalidNotification(error.message);
    throw error;
  }
}

function validateNotificationParams(params: Record<string, unknown> | undefined): void {
  if (params === undefined) return;
  assertKeys(params, ["_meta"], "notification params");
  assertMeta(params);
}

function validateCancelledParams(params: Record<string, unknown> | undefined): void {
  if (params === undefined) throw new InvalidNotification("cancelled notification params are required");
  assertKeys(params, ["_meta", "requestId", "reason"], "cancelled notification params");
  assertMeta(params);
  if (!isRequestId(params.requestId)) throw new InvalidNotification("cancelled notification requestId is required");
  if (params.reason !== undefined && typeof params.reason !== "string") throw new InvalidNotification("cancelled notification reason must be a string");
}

function assertKeys(record: Record<string, unknown>, allowed: readonly string[], name: string): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) throw new InvalidNotification(`${name} contains unsupported fields`);
}

function assertMeta(record: Record<string, unknown>): void {
  if (record._meta !== undefined && (typeof record._meta !== "object" || record._meta === null || Array.isArray(record._meta))) {
    throw new InvalidNotification("notification _meta must be an object");
  }
}

function isRequestId(value: unknown): value is string | number {
  if (typeof value === "string") return true;
  return typeof value === "number" && Number.isSafeInteger(value);
}

function invalidNotification(message: string): NotificationResult {
  return { status: 400, body: jsonRpcError(undefined, -32600, message) };
}

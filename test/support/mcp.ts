import assert from "node:assert/strict";
import type { TestService } from "./service-process.ts";
import { readJson, requireString } from "./http.ts";

export async function initializeMcp(service: TestService, options: { sendInitialized?: boolean } = {}): Promise<string> {
  const response = await postMcp(service, {
    jsonrpc: "2.0",
    id: "init",
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "0.1.0" } },
  });
  assert.equal(response.status, 200);
  const sessionId = requireString(response.headers.get("mcp-session-id"), "mcp-session-id");
  const body = await readJson(response);
  const result = body.result as Record<string, unknown>;
  assert.equal(result.protocolVersion, "2025-11-25");
  if (options.sendInitialized !== false) {
    const initialized = await postMcp(service, { jsonrpc: "2.0", method: "notifications/initialized" }, { sessionId });
    assert.equal(initialized.status, 202);
    assert.equal(await initialized.text(), "");
  }
  return sessionId;
}

export async function postMcp(
  service: TestService,
  body: Record<string, unknown>,
  options: { sessionId?: string; authorization?: string; origin?: string; contentType?: string; accept?: string; protocolVersion?: string } = {},
): Promise<Response> {
  const headers = new Headers({
    accept: options.accept ?? "application/json, text/event-stream",
    "content-type": options.contentType ?? "application/json",
    origin: options.origin ?? "https://chatgpt.com",
  });
  if (options.sessionId) headers.set("mcp-session-id", options.sessionId);
  if (options.sessionId) headers.set("mcp-protocol-version", options.protocolVersion ?? "2025-11-25");
  if (options.authorization) headers.set("authorization", options.authorization);
  return fetch(`${service.origin}/mcp`, { method: "POST", headers, body: JSON.stringify(body) });
}

export async function callTool(
  service: TestService,
  sessionId: string,
  name: string,
  authorization?: string,
): Promise<Record<string, unknown>> {
  const response = await postMcp(
    service,
    { jsonrpc: "2.0", id: name, method: "tools/call", params: { name, arguments: {} } },
    { sessionId, authorization },
  );
  assert.equal(response.status, 200);
  const envelope = await readJson(response);
  const result = envelope.result;
  assert.equal(typeof result, "object");
  assert.notEqual(result, null);
  return result as Record<string, unknown>;
}

export async function deleteSession(service: TestService, sessionId: string): Promise<Response> {
  return fetch(`${service.origin}/mcp`, {
    method: "DELETE",
    headers: {
      origin: "https://chatgpt.com",
      "mcp-session-id": sessionId,
      "mcp-protocol-version": "2025-11-25",
    },
  });
}

export function bearer(token: unknown): string {
  return `Bearer ${requireString(token, "access_token")}`;
}

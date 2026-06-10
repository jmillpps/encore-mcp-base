import assert from "node:assert/strict";
import type { TestService } from "./service-process.ts";
import { readJson, requireRecord, requireString } from "./http.ts";
import { completeAuthorizationCodeFlow } from "./oauth-client.ts";

const serviceAuthorizations = new Map<string, string>();
const sessionAuthorizations = new Map<string, string>();

export async function initializeMcp(service: TestService, options: { sendInitialized?: boolean; authorization?: string } = {}): Promise<string> {
  const authorization = options.authorization ?? await mcpAuthorization(service);
  const response = await postMcp(service, {
    jsonrpc: "2.0",
    id: "init",
    method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "0.1.0" } },
  }, { authorization });
  assert.equal(response.status, 200);
  const sessionId = requireString(response.headers.get("mcp-session-id"), "mcp-session-id");
  sessionAuthorizations.set(sessionKey(service, sessionId), authorization);
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
  options: { sessionId?: string; authorization?: string; skipAuthorization?: boolean; origin?: string; contentType?: string; accept?: string; protocolVersion?: string } = {},
): Promise<Response> {
  const headers = new Headers({
    accept: options.accept ?? "application/json, text/event-stream",
    "content-type": options.contentType ?? "application/json",
    origin: options.origin ?? "https://chatgpt.com",
  });
  if (options.sessionId) headers.set("mcp-session-id", options.sessionId);
  if (options.sessionId) headers.set("mcp-protocol-version", options.protocolVersion ?? "2025-11-25");
  const authorization = options.authorization ?? await storedMcpAuthorization(service, options.sessionId, options.skipAuthorization);
  if (authorization) headers.set("authorization", authorization);
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

export async function listMcpItems(
  service: TestService,
  sessionId: string,
  method: string,
  resultKey: string,
  authorization?: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 16; page += 1) {
    const response = await postMcp(
      service,
      { jsonrpc: "2.0", id: `${method}-${page}`, method, ...(cursor ? { params: { cursor } } : {}) },
      { sessionId, authorization },
    );
    assert.equal(response.status, 200);
    const result = requireRecord((await readJson(response)).result, `${method} result`);
    const pageItems = result[resultKey];
    assert.equal(Array.isArray(pageItems), true);
    items.push(...pageItems as Record<string, unknown>[]);
    const nextCursor = result.nextCursor;
    if (nextCursor === undefined) return items;
    cursor = requireString(nextCursor, "nextCursor");
  }
  throw new Error(`${method} pagination did not terminate`);
}

export async function deleteSession(service: TestService, sessionId: string): Promise<Response> {
  const authorization = await storedMcpAuthorization(service, sessionId, false);
  const headers = new Headers({
    origin: "https://chatgpt.com",
    "mcp-session-id": sessionId,
    "mcp-protocol-version": "2025-11-25",
  });
  if (authorization) headers.set("authorization", authorization);
  return fetch(`${service.origin}/mcp`, {
    method: "DELETE",
    headers,
  });
}

export function bearer(token: unknown): string {
  return `Bearer ${requireString(token, "access_token")}`;
}

export async function mcpAuthorization(service: TestService): Promise<string> {
  const existing = serviceAuthorizations.get(service.origin);
  if (existing) return existing;
  const flow = await completeAuthorizationCodeFlow(service, service.mcpResource);
  const authorization = bearer(flow.tokens.access_token);
  serviceAuthorizations.set(service.origin, authorization);
  return authorization;
}

async function storedMcpAuthorization(service: TestService, sessionId: string | undefined, skip: boolean | undefined): Promise<string | undefined> {
  if (skip) return undefined;
  if (sessionId) return sessionAuthorizations.get(sessionKey(service, sessionId)) ?? await mcpAuthorization(service);
  return mcpAuthorization(service);
}

function sessionKey(service: TestService, sessionId: string): string {
  return `${service.origin}\n${sessionId}`;
}

import type { ServerResponse } from "node:http";
import { randomToken } from "../shared/crypto.ts";
import { ServiceError } from "../shared/errors.ts";
import type { JsonRpcId } from "./json-rpc.ts";
import { duplicateRequestIdError, mcpRequestIdHash, mcpRequestIdLimit } from "./request-id.ts";
import { acquireSseConnection } from "./sse-connection-limit.ts";
import { writeSseComment, writeSseEvent, writeSseHeaders } from "./sse-event.ts";

const heartbeatMs = 25000;
const sessionIdPattern = /^[A-Za-z0-9_-]{16,256}$/;
const sessions = new Map<string, LegacySseSession>();

interface LegacySseSession {
  id: string;
  res: ServerResponse;
  heartbeat: NodeJS.Timeout;
  requestIdHashes: Set<string>;
  sequence: number;
}

export async function runLegacySseSession(res: ServerResponse, maxConnections: number): Promise<void> {
  const releaseConnection = acquireSseConnection(maxConnections);
  let session: LegacySseSession | undefined;
  try {
    session = createLegacySseSession(res);
    writeSseHeaders(res);
    await writeSseEvent(res, "endpoint", `/messages?sessionId=${encodeURIComponent(session.id)}`);
    await waitForClose(res);
  } finally {
    if (session) closeLegacySseSession(session.id);
    releaseConnection();
  }
}

export function readLegacySseSessionId(url: string | undefined): string {
  const sessionId = new URL(url ?? "/", "http://localhost").searchParams.get("sessionId") ?? "";
  if (!sessionIdPattern.test(sessionId)) throw new ServiceError("bad_request", "invalid sse session", 400);
  return sessionId;
}

export async function sendLegacySseMessage(sessionId: string, body: Record<string, unknown>): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session || session.res.destroyed || session.res.writableEnded) {
    closeLegacySseSession(sessionId);
    throw new ServiceError("not_found", "sse session not found", 404);
  }
  await writeSseEvent(session.res, "message", JSON.stringify(body), nextEventId(session));
}

export function reserveLegacyRequestId(sessionId: string, id: JsonRpcId): void {
  const session = sessions.get(sessionId);
  if (!session || session.res.destroyed || session.res.writableEnded) throw new ServiceError("not_found", "sse session not found", 404);
  const hash = mcpRequestIdHash(id);
  if (session.requestIdHashes.has(hash)) throw duplicateRequestIdError();
  if (session.requestIdHashes.size >= mcpRequestIdLimit) throw new ServiceError("rate_limited", "too many mcp request ids", 429);
  session.requestIdHashes.add(hash);
}

function createLegacySseSession(res: ServerResponse): LegacySseSession {
  const id = randomToken(24);
  const session: LegacySseSession = {
    id,
    res,
    heartbeat: setInterval(() => void writeSseComment(res, "heartbeat").catch(() => closeLegacySseSession(id)), heartbeatMs),
    requestIdHashes: new Set<string>(),
    sequence: 0,
  };
  session.heartbeat.unref();
  sessions.set(id, session);
  return session;
}

function closeLegacySseSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  clearInterval(session.heartbeat);
  sessions.delete(sessionId);
}

function nextEventId(session: LegacySseSession): string {
  session.sequence += 1;
  return `${session.id}.${session.sequence}`;
}

function waitForClose(res: ServerResponse): Promise<void> {
  if (res.destroyed || res.writableEnded) return Promise.resolve();
  return new Promise((resolve) => res.once("close", resolve));
}

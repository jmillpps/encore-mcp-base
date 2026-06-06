import type { ServerResponse } from "node:http";
import { randomToken } from "../shared/crypto.ts";
import { ServiceError } from "../shared/errors.ts";
import { writeSseComment, writeSseEvent, writeSseHeaders } from "./sse-event.ts";

const heartbeatMs = 25000;
const sessionIdPattern = /^[A-Za-z0-9_-]{16,256}$/;
const sessions = new Map<string, LegacySseSession>();

interface LegacySseSession {
  id: string;
  res: ServerResponse;
  heartbeat: NodeJS.Timeout;
  sequence: number;
}

export async function runLegacySseSession(res: ServerResponse): Promise<void> {
  const session = createLegacySseSession(res);
  writeSseHeaders(res);
  try {
    await writeSseEvent(res, "endpoint", `/messages?sessionId=${encodeURIComponent(session.id)}`);
    await waitForClose(res);
  } finally {
    closeLegacySseSession(session.id);
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

function createLegacySseSession(res: ServerResponse): LegacySseSession {
  const id = randomToken(24);
  const session: LegacySseSession = {
    id,
    res,
    heartbeat: setInterval(() => void writeSseComment(res, "heartbeat").catch(() => closeLegacySseSession(id)), heartbeatMs),
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

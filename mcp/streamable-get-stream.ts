import type { ServerResponse } from "node:http";
import { acquireSseConnection } from "./sse-connection-limit.ts";
import { writeSseComment, writeSseHeaders } from "./sse-event.ts";

const heartbeatMs = 25000;

export async function runStreamableGetStream(res: ServerResponse, maxConnections: number): Promise<void> {
  const releaseConnection = acquireSseConnection(maxConnections);
  let heartbeat: NodeJS.Timeout | undefined;
  try {
    writeSseHeaders(res);
    heartbeat = setInterval(() => void writeSseComment(res, "heartbeat").catch(() => res.destroy()), heartbeatMs);
    heartbeat.unref();
    await writeSseComment(res, "ready");
    await waitForClose(res);
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    releaseConnection();
  }
}

function waitForClose(res: ServerResponse): Promise<void> {
  if (res.destroyed || res.writableEnded) return Promise.resolve();
  return new Promise((resolve) => res.once("close", resolve));
}

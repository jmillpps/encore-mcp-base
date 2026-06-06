import type { ServerResponse } from "node:http";
import { writeSseComment, writeSseHeaders } from "./sse-event.ts";

const heartbeatMs = 25000;

export async function runStreamableGetStream(res: ServerResponse): Promise<void> {
  writeSseHeaders(res);
  const heartbeat = setInterval(() => void writeSseComment(res, "heartbeat").catch(() => res.destroy()), heartbeatMs);
  heartbeat.unref();
  try {
    await writeSseComment(res, "ready");
    await waitForClose(res);
  } finally {
    clearInterval(heartbeat);
  }
}

function waitForClose(res: ServerResponse): Promise<void> {
  if (res.destroyed || res.writableEnded) return Promise.resolve();
  return new Promise((resolve) => res.once("close", resolve));
}

import { once } from "node:events";
import type { ServerResponse } from "node:http";

export function writeSseHeaders(res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
}

export async function writeSseEvent(res: ServerResponse, event: string, data: string, id?: string): Promise<void> {
  const lines = [
    ...(id ? [`id: ${id}`] : []),
    `event: ${event}`,
    ...data.split(/\r?\n/).map((line) => `data: ${line}`),
    "",
    "",
  ];
  await writeSseFrame(res, lines.join("\n"));
}

export async function writeSseComment(res: ServerResponse, value: string): Promise<void> {
  await writeSseFrame(res, `: ${value}\n\n`);
}

async function writeSseFrame(res: ServerResponse, frame: string): Promise<void> {
  if (res.destroyed || res.writableEnded) throw new Error("sse stream closed");
  if (res.write(frame)) return;
  await once(res, "drain");
}

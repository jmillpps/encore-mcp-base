import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

export interface SseEvent {
  event: string;
  data: string;
  id?: string;
}

type SseChunk = { done: boolean; value?: Uint8Array };

export class SseReader {
  private readonly decoder = new TextDecoder();
  private buffer = "";
  readonly reader: ReadableStreamDefaultReader<Uint8Array>;

  constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.reader = reader;
  }

  async readEvent(timeoutMs = 1000): Promise<SseEvent> {
    for (;;) {
      const boundary = this.buffer.indexOf("\n\n");
      if (boundary >= 0) {
        const block = this.buffer.slice(0, boundary);
        this.buffer = this.buffer.slice(boundary + 2);
        const event = parseSseBlock(block);
        if (event) return event;
      }
      const chunk = await readChunk(this.reader, timeoutMs);
      if (chunk.done) throw new Error("sse stream ended");
      if (!chunk.value) throw new Error("sse chunk missing value");
      this.buffer += this.decoder.decode(chunk.value, { stream: true });
    }
  }
}

export async function assertSseOpen(stream: SseReader, timeoutMs = 100): Promise<void> {
  const status = await Promise.race([stream.reader.closed.then(() => "closed" as const), delay(timeoutMs).then(() => "open" as const)]);
  assert.equal(status, "open");
}

function parseSseBlock(block: string): SseEvent | undefined {
  const event: SseEvent = { event: "message", data: "" };
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, "") : "";
    if (field === "event") event.event = value;
    if (field === "id") event.id = value;
    if (field === "data") data.push(value);
  }
  if (!event.id && event.event === "message" && data.length === 0) return undefined;
  event.data = data.join("\n");
  return event;
}

function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>, timeoutMs: number): Promise<SseChunk> {
  return Promise.race([
    reader.read(),
    delay(timeoutMs).then(() => {
      throw new Error("timed out waiting for sse event");
    }),
  ]);
}

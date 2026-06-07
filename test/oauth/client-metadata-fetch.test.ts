import { Buffer } from "node:buffer";
import { once } from "node:events";
import { createServer, type AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { fetchMetadataDocument } from "../../auth/client-metadata-fetch.ts";
import { ServiceError } from "../../shared/errors.ts";

interface QueuedMetadataResponse {
  readonly headers: readonly string[];
  readonly body: string;
}

test("metadata document fetch accepts JSON metadata response", async (t) => {
  const body = metadataBody();
  const server = await startQueuedMetadataServer(t, [{ body, headers: ["Content-Type: application/json", "Cache-Control: no-store"] }]);
  const result = await fetchMetadataDocument(new URL(`${server.origin}/client.json`), undefined);
  assert.deepEqual(result, { body: { ok: true }, cacheSeconds: 0 });
});

test("metadata document fetch rejects duplicate singleton metadata headers and continues serving", async (t) => {
  const body = metadataBody();
  const server = await startQueuedMetadataServer(t, [
    { body, headers: ["Content-Type: application/json", "Content-Type: application/json", "Cache-Control: no-store"] },
    { body, headers: ["Content-Type: application/json", "Cache-Control: no-store"] },
  ]);
  await assert.rejects(
    () => fetchMetadataDocument(new URL(`${server.origin}/client.json`), undefined),
    (error) => error instanceof ServiceError && error.code === "invalid_client",
  );
  const result = await fetchMetadataDocument(new URL(`${server.origin}/client.json`), undefined);
  assert.deepEqual(result, { body: { ok: true }, cacheSeconds: 0 });
});

async function startQueuedMetadataServer(t: TestContext, responses: readonly QueuedMetadataResponse[]): Promise<{ origin: string }> {
  const pending = [...responses];
  const server = createServer((socket) => {
    socket.once("data", () => {
      const response = pending.shift();
      if (!response) {
        socket.end("HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
        return;
      }
      socket.end(rawResponse(response));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("metadata server did not bind TCP");
  return { origin: `http://127.0.0.1:${(address as AddressInfo).port}` };
}

function rawResponse(response: QueuedMetadataResponse): string {
  return [
    "HTTP/1.1 200 OK",
    "Connection: close",
    ...response.headers,
    `Content-Length: ${Buffer.byteLength(response.body)}`,
    "",
    response.body,
  ].join("\r\n");
}

function metadataBody(): string {
  return JSON.stringify({ ok: true });
}

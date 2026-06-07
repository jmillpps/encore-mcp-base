import { Buffer } from "node:buffer";
import { connect } from "node:net";

export interface RawHttpResponse {
  status: number;
  headers: Record<string, string[]>;
  body: string;
}

export async function rawHttpRequest(origin: string, requestLines: readonly string[], body = ""): Promise<RawHttpResponse> {
  const url = new URL(origin);
  const port = Number(url.port);
  const socket = connect({ host: url.hostname, port });
  socket.setEncoding("utf8");
  socket.setTimeout(5000, () => socket.destroy(new Error("raw http request timed out")));
  const chunks: string[] = [];
  const payload = `${requestLines.join("\r\n")}\r\n\r\n${body}`;
  return new Promise((resolveResponse, reject) => {
    socket.once("connect", () => socket.write(payload));
    socket.on("data", (chunk) => chunks.push(String(chunk)));
    socket.once("error", reject);
    socket.once("end", () => {
      try {
        resolveResponse(parseRawResponse(chunks.join("")));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function hostHeader(origin: string): string {
  const url = new URL(origin);
  return url.host;
}

export function contentLength(body: string): string {
  return String(Buffer.byteLength(body));
}

function parseRawResponse(raw: string): RawHttpResponse {
  const separator = raw.indexOf("\r\n\r\n");
  if (separator < 0) throw new Error("raw response missing header separator");
  const headerLines = raw.slice(0, separator).split("\r\n");
  const statusLine = headerLines.shift() ?? "";
  const statusMatch = /^HTTP\/1\.[01] ([0-9]{3})\b/.exec(statusLine);
  if (!statusMatch?.[1]) throw new Error("raw response status line is invalid");
  const headers: Record<string, string[]> = {};
  for (const line of headerLines) {
    const index = line.indexOf(":");
    if (index < 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    headers[key] = [...(headers[key] ?? []), value];
  }
  return { status: Number(statusMatch[1]), headers, body: raw.slice(separator + 4) };
}

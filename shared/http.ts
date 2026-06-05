import type { IncomingMessage, ServerResponse } from "node:http";
import { ServiceError } from "./errors.ts";

export async function readBody(req: IncomingMessage, limit = 32768): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new ServiceError("bad_request", "request body too large", 413);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonBody(req: IncomingMessage, limit = 32768): Promise<unknown> {
  try {
    return JSON.parse(await readBody(req, limit));
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("bad_request", "invalid json", 400);
  }
}

export async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  const type = String(req.headers["content-type"] ?? "");
  if (!type.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    throw new ServiceError("bad_request", "unsupported content type", 415);
  }
  return new URLSearchParams(await readBody(req));
}

export function writeJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

export function writeNoContent(res: ServerResponse, status = 204, headers: Record<string, string> = {}): void {
  res.writeHead(status, headers);
  res.end();
}

export function writeRedirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { location });
  res.end();
}

export function writeError(res: ServerResponse, error: unknown): void {
  if (error instanceof ServiceError) {
    writeJson(res, error.status, { error: error.code, error_description: error.message });
    return;
  }
  writeJson(res, 500, { error: "server_error", error_description: "internal server error" });
}

import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServiceConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { acceptsMediaType, contentTypeUsesUtf8, mediaType } from "../shared/media-type.ts";

export function validateOrigin(config: ServiceConfig, req: IncomingMessage): void {
  const origin = req.headers.origin;
  if (origin && !config.allowedOrigins.includes(origin)) {
    throw new ServiceError("forbidden", "origin is not allowed", 403);
  }
}

export function validatePostAccept(req: IncomingMessage): void {
  const accept = String(req.headers.accept ?? "");
  if (!acceptsMediaType(accept, "application/json") || !acceptsMediaType(accept, "text/event-stream")) {
    throw new ServiceError("bad_request", "invalid accept header", 400);
  }
}

export function validatePostContentType(req: IncomingMessage): void {
  const contentType = String(req.headers["content-type"] ?? "");
  if (mediaType(contentType) !== "application/json" || !contentTypeUsesUtf8(contentType)) {
    throw new ServiceError("bad_request", "unsupported content type", 415);
  }
}

export function validateSseAccept(req: IncomingMessage): void {
  const accept = String(req.headers.accept ?? "");
  if (!acceptsMediaType(accept, "text/event-stream")) {
    throw new ServiceError("bad_request", "invalid accept header", 400);
  }
}

export function readMcpSessionId(req: IncomingMessage): string {
  const value = String(req.headers["mcp-session-id"] ?? "");
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(value)) throw new ServiceError("bad_request", "invalid mcp session", 400);
  return value;
}

export function validateNoMcpSessionId(req: IncomingMessage): void {
  if (req.headers["mcp-session-id"] !== undefined) {
    throw new ServiceError("bad_request", "initialize must not include mcp session", 400);
  }
}

export function readMcpProtocolVersion(req: IncomingMessage, required: boolean): string | undefined {
  const value = String(req.headers["mcp-protocol-version"] ?? "");
  if (!value) {
    if (required) throw new ServiceError("bad_request", "missing mcp protocol version", 400);
    return undefined;
  }
  return value;
}

export function writeCors(config: ServiceConfig, req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
  }
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "Authorization,Content-Type,Accept,MCP-Protocol-Version,MCP-Session-Id,Last-Event-ID");
}

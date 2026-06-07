import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { requestSubject, writeError, writeJson, writeNoContent } from "../shared/http.ts";
import { acceptsMediaType } from "../shared/media-type.ts";
import { createMcpSession, terminateMcpSession, touchMcpSession } from "./session-store.ts";
import { runStreamableGetStream } from "./streamable-get-stream.ts";
import { handleMcpJson } from "./protocol.ts";
import { negotiateProtocolVersion } from "./protocol-version.ts";
import { isMcpBodyResult, readMcpJsonBody } from "./request-body.ts";
import { readMcpProtocolVersion, readMcpSessionId, validateOrigin, validatePostAccept, validatePostContentType, writeCors } from "./transport-headers.ts";

export const mcpOptions = api.raw({ expose: true, method: "OPTIONS", path: "/mcp" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    writeCors(config, req, res);
    writeNoContent(res);
  } catch (error) {
    writeError(res, error, { endpoint: "mcp.options", method: "OPTIONS", subject: requestSubject(req) });
  }
});

export const mcpPost = api.raw({ expose: true, method: "POST", path: "/mcp" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    validatePostAccept(req);
    validatePostContentType(req);
    writeCors(config, req, res);
    const body = await readMcpJsonBody(req);
    if (isMcpBodyResult(body)) {
      writeJson(res, body.status, body.body);
      return;
    }
    const method = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>).method : undefined;
    const protocolVersion = negotiateProtocolVersion(readMcpProtocolVersion(req, method !== "initialize"));
    const session = method === "initialize" ? { initialized: true } : await touchMcpSession(config, readMcpSessionId(req), protocolVersion, method === "notifications/initialized");
    const result = await handleMcpJson({ config, authorization: String(req.headers.authorization ?? ""), rateLimitSubject: requestSubject(req), sessionInitialized: session.initialized }, body);
    if (result.initialized) res.setHeader("MCP-Session-Id", await createMcpSession(config, protocolVersion, result.clientId ?? "unknown-mcp-client"));
    if (result.wwwAuthenticate) res.setHeader("www-authenticate", result.wwwAuthenticate);
    if (!result.body) writeNoContent(res, result.status);
    else writeJson(res, result.status, result.body);
  } catch (error) {
    writeError(res, error, { endpoint: "mcp.post", method: "POST", subject: requestSubject(req) });
  }
});

export const mcpGet = api.raw({ expose: true, method: "GET", path: "/mcp" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    const accept = String(req.headers.accept ?? "");
    if (!acceptsMediaType(accept, "text/event-stream")) throw new ServiceError("bad_request", "invalid accept header", 400);
    const protocolVersion = negotiateProtocolVersion(readMcpProtocolVersion(req, true));
    await touchMcpSession(config, readMcpSessionId(req), protocolVersion);
    writeCors(config, req, res);
    await runStreamableGetStream(res);
  } catch (error) {
    if (res.headersSent) res.destroy();
    else writeError(res, error, { endpoint: "mcp.get", method: "GET", subject: requestSubject(req) });
  }
});

export const mcpDelete = api.raw({ expose: true, method: "DELETE", path: "/mcp" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    const protocolVersion = negotiateProtocolVersion(readMcpProtocolVersion(req, true));
    await touchMcpSession(config, readMcpSessionId(req), protocolVersion);
    await terminateMcpSession(config, readMcpSessionId(req));
    writeCors(config, req, res);
    writeNoContent(res);
  } catch (error) {
    writeError(res, error, { endpoint: "mcp.delete", method: "DELETE", subject: requestSubject(req) });
  }
});

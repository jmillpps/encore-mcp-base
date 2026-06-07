import { api } from "encore.dev/api";
import { validateSingleAuthorizationHeader } from "../auth/authorization-header.ts";
import { verifyBearer, verifyPresentedBearer } from "../auth/bearer.ts";
import { readConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { requestSubject, writeError, writeJson, writeNoContent } from "../shared/http.ts";
import { acceptsMediaType } from "../shared/media-type.ts";
import { createMcpSession, reserveMcpRequestId, terminateMcpSession, touchMcpSession } from "./session-store.ts";
import { runStreamableGetStream } from "./streamable-get-stream.ts";
import { handleMcpJson } from "./protocol.ts";
import { negotiateProtocolVersion } from "./protocol-version.ts";
import { isMcpBodyResult, readMcpJsonBody } from "./request-body.ts";
import { readMcpProtocolVersion, readMcpSessionId, validateNoAccessTokenQuery, validateNoMcpSessionId, validateOrigin, validatePostAccept, validatePostContentType, writeCors } from "./transport-headers.ts";
import { writeMcpTransportError } from "./transport-error.ts";

export const mcpOptions = api.raw({ expose: true, method: "OPTIONS", path: "/mcp" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    validateNoAccessTokenQuery(req);
    validateSingleAuthorizationHeader(req);
    writeCors(config, req, res);
    writeNoContent(res);
  } catch (error) {
    writeError(res, error, { endpoint: "mcp.options", method: "OPTIONS", subject: requestSubject(req) });
  }
});

export const mcpPost = api.raw({ expose: true, method: "POST", path: "/mcp" }, async (req, res) => {
  let config: ReturnType<typeof readConfig> | undefined;
  try {
    config = readConfig();
    const activeConfig = config;
    validateOrigin(activeConfig, req);
    validateNoAccessTokenQuery(req);
    validateSingleAuthorizationHeader(req);
    validatePostAccept(req);
    validatePostContentType(req);
    writeCors(activeConfig, req, res);
    const body = await readMcpJsonBody(req);
    if (isMcpBodyResult(body)) {
      writeJson(res, body.status, body.body);
      return;
    }
    const method = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>).method : undefined;
    if (method === "initialize") validateNoMcpSessionId(req);
    const sessionId = method === "initialize" ? undefined : readMcpSessionId(req);
    if (sessionId === undefined) verifyPresentedBearer(activeConfig, req.headers.authorization, activeConfig.mcpResource);
    else verifyBearer(activeConfig, req.headers.authorization, activeConfig.mcpResource);
    const protocolVersion = method === "initialize" ? negotiateProtocolVersion(readMcpProtocolVersion(req, false)) : readMcpProtocolVersion(req, false);
    const session = sessionId === undefined ? { initialized: false } : await touchMcpSession(activeConfig, sessionId, protocolVersion);
    const result = await handleMcpJson({
      config: activeConfig,
      authorization: String(req.headers.authorization ?? ""),
      rateLimitSubject: requestSubject(req),
      reserveRequestId: sessionId === undefined ? undefined : (id) => reserveMcpRequestId(activeConfig, sessionId, id),
      sessionInitialized: session.initialized,
    }, body);
    if (result.initialized) res.setHeader("MCP-Session-Id", await createMcpSession(activeConfig, protocolVersion ?? negotiateProtocolVersion(undefined), result.clientId ?? "unknown-mcp-client"));
    if (method === "notifications/initialized" && result.status === 202 && !result.body && sessionId !== undefined) await touchMcpSession(activeConfig, sessionId, protocolVersion, true);
    if (result.wwwAuthenticate) res.setHeader("www-authenticate", result.wwwAuthenticate);
    if (!result.body) writeNoContent(res, result.status);
    else writeJson(res, result.status, result.body);
  } catch (error) {
    writeMcpTransportError(config, res, error, { endpoint: "mcp.post", method: "POST", subject: requestSubject(req) });
  }
});

export const mcpGet = api.raw({ expose: true, method: "GET", path: "/mcp" }, async (req, res) => {
  let config: ReturnType<typeof readConfig> | undefined;
  try {
    config = readConfig();
    validateOrigin(config, req);
    validateNoAccessTokenQuery(req);
    validateSingleAuthorizationHeader(req);
    verifyBearer(config, req.headers.authorization, config.mcpResource);
    const accept = String(req.headers.accept ?? "");
    if (!acceptsMediaType(accept, "text/event-stream")) throw new ServiceError("bad_request", "invalid accept header", 400);
    const protocolVersion = readMcpProtocolVersion(req, false);
    await touchMcpSession(config, readMcpSessionId(req), protocolVersion);
    writeCors(config, req, res);
    await runStreamableGetStream(res, config.mcpSseMaxConnections);
  } catch (error) {
    if (res.headersSent) res.destroy();
    else writeMcpTransportError(config, res, error, { endpoint: "mcp.get", method: "GET", subject: requestSubject(req) });
  }
});

export const mcpDelete = api.raw({ expose: true, method: "DELETE", path: "/mcp" }, async (req, res) => {
  let config: ReturnType<typeof readConfig> | undefined;
  try {
    config = readConfig();
    validateOrigin(config, req);
    validateNoAccessTokenQuery(req);
    validateSingleAuthorizationHeader(req);
    verifyBearer(config, req.headers.authorization, config.mcpResource);
    const protocolVersion = readMcpProtocolVersion(req, false);
    await touchMcpSession(config, readMcpSessionId(req), protocolVersion);
    await terminateMcpSession(config, readMcpSessionId(req));
    writeCors(config, req, res);
    writeNoContent(res);
  } catch (error) {
    writeMcpTransportError(config, res, error, { endpoint: "mcp.delete", method: "DELETE", subject: requestSubject(req) });
  }
});

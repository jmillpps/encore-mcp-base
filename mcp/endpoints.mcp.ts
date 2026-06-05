import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { readBody, writeError, writeJson, writeNoContent } from "../shared/http.ts";
import { createMcpSession, terminateMcpSession, touchMcpSession } from "./session-store.ts";
import { handleMcpJson } from "./protocol.ts";
import { negotiateProtocolVersion } from "./protocol-version.ts";
import { readMcpProtocolVersion, readMcpSessionId, validateOrigin, validatePostAccept, validatePostContentType, writeCors } from "./transport-headers.ts";

export const mcpOptions = api.raw({ expose: true, method: "OPTIONS", path: "/mcp" }, async (req, res) => {
  const config = readConfig();
  writeCors(config, req, res);
  writeNoContent(res);
});

export const mcpPost = api.raw({ expose: true, method: "POST", path: "/mcp" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    validatePostAccept(req);
    validatePostContentType(req);
    writeCors(config, req, res);
    const body = JSON.parse(await readBody(req));
    const method = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>).method : undefined;
    const protocolVersion = negotiateProtocolVersion(readMcpProtocolVersion(req, method !== "initialize"));
    if (method !== "initialize") await touchMcpSession(config, readMcpSessionId(req), protocolVersion);
    const result = await handleMcpJson({ config, authorization: String(req.headers.authorization ?? "") }, body);
    if (result.initialized) res.setHeader("mcp-session-id", await createMcpSession(config, protocolVersion));
    if (!result.body) writeNoContent(res, result.status);
    else writeJson(res, result.status, result.body);
  } catch (error) {
    writeError(res, error);
  }
});

export const mcpGet = api.raw({ expose: true, method: "GET", path: "/mcp" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    const accept = String(req.headers.accept ?? "");
    if (!accept.includes("text/event-stream")) throw new ServiceError("bad_request", "invalid accept header", 400);
    writeCors(config, req, res);
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
    res.end("event: message\ndata: {}\n\n");
  } catch (error) {
    writeError(res, error);
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
    writeError(res, error);
  }
});

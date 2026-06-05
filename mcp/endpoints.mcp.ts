import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { ServiceError } from "../shared/errors.ts";
import { readBody, writeError, writeJson, writeNoContent } from "../shared/http.ts";
import { createMcpSession } from "./session-store.ts";
import { handleMcpJson } from "./protocol.ts";
import { validateOrigin, validatePostAccept, writeCors } from "./transport-headers.ts";

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
    writeCors(config, req, res);
    const body = JSON.parse(await readBody(req));
    const result = await handleMcpJson({ config, authorization: String(req.headers.authorization ?? "") }, body);
    if (result.initialized) res.setHeader("mcp-session-id", await createMcpSession(config, "2025-11-25"));
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
  const config = readConfig();
  writeCors(config, req, res);
  writeNoContent(res);
});

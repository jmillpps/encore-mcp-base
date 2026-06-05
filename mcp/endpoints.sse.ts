import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { readJsonBody, requestSubject, writeError, writeJson } from "../shared/http.ts";
import { handleMcpJson } from "./protocol.ts";
import { validateOrigin, validatePostContentType, writeCors } from "./transport-headers.ts";

export const sse = api.raw({ expose: true, method: "GET", path: "/sse" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    writeCors(config, req, res);
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
    res.end(`event: endpoint\ndata: ${JSON.stringify({ endpoint: "/messages" })}\n\n`);
  } catch (error) {
    writeError(res, error, { endpoint: "mcp.sse", method: "GET", subject: requestSubject(req) });
  }
});

export const messages = api.raw({ expose: true, method: "POST", path: "/messages" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    validatePostContentType(req);
    writeCors(config, req, res);
    const result = await handleMcpJson({ config, authorization: String(req.headers.authorization ?? ""), rateLimitSubject: requestSubject(req) }, await readJsonBody(req));
    if (result.wwwAuthenticate) res.setHeader("www-authenticate", result.wwwAuthenticate);
    if (!result.body) {
      res.writeHead(result.status);
      res.end();
      return;
    }
    writeJson(res, result.status, result.body);
  } catch (error) {
    writeError(res, error, { endpoint: "mcp.messages", method: "POST", subject: requestSubject(req) });
  }
});

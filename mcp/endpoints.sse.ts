import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { requestSubject, writeError, writeJson } from "../shared/http.ts";
import { readLegacySseSessionId, runLegacySseSession, sendLegacySseMessage } from "./legacy-sse-session.ts";
import { handleMcpJson } from "./protocol.ts";
import { isMcpBodyResult, readMcpJsonBody } from "./request-body.ts";
import { validateOrigin, validatePostContentType, validateSseAccept, writeCors } from "./transport-headers.ts";

export const sse = api.raw({ expose: true, method: "GET", path: "/sse" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    validateSseAccept(req);
    writeCors(config, req, res);
    await runLegacySseSession(res);
  } catch (error) {
    if (res.headersSent) res.destroy();
    else writeError(res, error, { endpoint: "mcp.sse", method: "GET", subject: requestSubject(req) });
  }
});

export const messages = api.raw({ expose: true, method: "POST", path: "/messages" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    validatePostContentType(req);
    writeCors(config, req, res);
    const sessionId = readLegacySseSessionId(req.url);
    const body = await readMcpJsonBody(req);
    if (isMcpBodyResult(body)) {
      writeJson(res, body.status, body.body);
      return;
    }
    const result = await handleMcpJson({ config, authorization: String(req.headers.authorization ?? ""), rateLimitSubject: requestSubject(req) }, body);
    if (result.wwwAuthenticate) res.setHeader("www-authenticate", result.wwwAuthenticate);
    if (result.body) await sendLegacySseMessage(sessionId, result.body);
    res.writeHead(202);
    res.end();
  } catch (error) {
    writeError(res, error, { endpoint: "mcp.messages", method: "POST", subject: requestSubject(req) });
  }
});

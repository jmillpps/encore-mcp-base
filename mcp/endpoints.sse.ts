import { api } from "encore.dev/api";
import { validateSingleAuthorizationHeader } from "../auth/authorization-header.ts";
import { verifyPresentedBearer } from "../auth/bearer.ts";
import { readConfig } from "../shared/config.ts";
import { requestSubject, writeJson } from "../shared/http.ts";
import { readLegacySseSessionId, reserveLegacyRequestId, runLegacySseSession, sendLegacySseMessage } from "./legacy-sse-session.ts";
import { handleMcpJson } from "./protocol.ts";
import { isMcpBodyResult, readMcpJsonBody } from "./request-body.ts";
import { validateNoAccessTokenQuery, validateOrigin, validatePostContentType, validateSseAccept, writeCors } from "./transport-headers.ts";
import { writeMcpTransportError } from "./transport-error.ts";

export const sse = api.raw({ expose: true, method: "GET", path: "/sse" }, async (req, res) => {
  let config: ReturnType<typeof readConfig> | undefined;
  try {
    config = readConfig();
    validateOrigin(config, req);
    validateNoAccessTokenQuery(req);
    validateSingleAuthorizationHeader(req);
    verifyPresentedBearer(config, req.headers.authorization, config.mcpResource);
    validateSseAccept(req);
    writeCors(config, req, res);
    await runLegacySseSession(res, config.mcpSseMaxConnections);
  } catch (error) {
    if (res.headersSent) res.destroy();
    else writeMcpTransportError(config, res, error, { endpoint: "mcp.sse", method: "GET", subject: requestSubject(req) });
  }
});

export const messages = api.raw({ expose: true, method: "POST", path: "/messages" }, async (req, res) => {
  let config: ReturnType<typeof readConfig> | undefined;
  try {
    config = readConfig();
    validateOrigin(config, req);
    validateNoAccessTokenQuery(req);
    validateSingleAuthorizationHeader(req);
    verifyPresentedBearer(config, req.headers.authorization, config.mcpResource);
    validatePostContentType(req);
    writeCors(config, req, res);
    const sessionId = readLegacySseSessionId(req.url);
    const body = await readMcpJsonBody(req);
    if (isMcpBodyResult(body)) {
      writeJson(res, body.status, body.body);
      return;
    }
    const result = await handleMcpJson({
      config,
      authorization: String(req.headers.authorization ?? ""),
      rateLimitSubject: requestSubject(req),
      reserveRequestId: (id) => Promise.resolve(reserveLegacyRequestId(sessionId, id)),
    }, body);
    if (result.wwwAuthenticate) res.setHeader("www-authenticate", result.wwwAuthenticate);
    if (result.body) await sendLegacySseMessage(sessionId, result.body);
    res.writeHead(202);
    res.end();
  } catch (error) {
    writeMcpTransportError(config, res, error, { endpoint: "mcp.messages", method: "POST", subject: requestSubject(req) });
  }
});

import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { readBody, writeError, writeJson } from "../shared/http.ts";
import { handleMcpJson } from "./protocol.ts";
import { validateOrigin, writeCors } from "./transport-headers.ts";

export const sse = api.raw({ expose: true, method: "GET", path: "/sse" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    writeCors(config, req, res);
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
    res.end(`event: endpoint\ndata: ${JSON.stringify({ endpoint: "/messages" })}\n\n`);
  } catch (error) {
    writeError(res, error);
  }
});

export const messages = api.raw({ expose: true, method: "POST", path: "/messages" }, async (req, res) => {
  try {
    const config = readConfig();
    validateOrigin(config, req);
    writeCors(config, req, res);
    const result = await handleMcpJson({ config, authorization: String(req.headers.authorization ?? "") }, JSON.parse(await readBody(req)));
    if (!result.body) {
      res.writeHead(result.status);
      res.end();
      return;
    }
    writeJson(res, result.status, result.body);
  } catch (error) {
    writeError(res, error);
  }
});

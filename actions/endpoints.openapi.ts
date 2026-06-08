import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { openApiDocument } from "./openapi-document.ts";

export const openapi = api.raw({ expose: true, method: "GET", path: "/actions/openapi.json" }, async (_req, res) => {
  const body = `${JSON.stringify(openApiDocument(readConfig().issuer), null, 2)}\n`;
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=300",
  });
  res.end(body);
});

import type { ServerResponse } from "node:http";
import { api } from "encore.dev/api";
import { writeError } from "../shared/http.ts";
import { writeWidgetAsset } from "./widgets/asset-response.ts";

export const widgetBridgeScriptAsset = api.raw({ expose: true, method: "GET", path: "/app-ui/mcp-widget-bridge-v1.js" }, async (_req, res) => {
  writeAsset(res, "/app-ui/mcp-widget-bridge-v1.js");
});

export const toolResultCardBaseStyleAsset = api.raw({ expose: true, method: "GET", path: "/app-ui/tool-result-card-base-v1.css" }, async (_req, res) => {
  writeAsset(res, "/app-ui/tool-result-card-base-v1.css");
});

export const healthStatusCardScriptAsset = api.raw({ expose: true, method: "GET", path: "/app-ui/health-status-card-v1.js" }, async (_req, res) => {
  writeAsset(res, "/app-ui/health-status-card-v1.js");
});

export const healthStatusCardStyleAsset = api.raw({ expose: true, method: "GET", path: "/app-ui/health-status-card-v1.css" }, async (_req, res) => {
  writeAsset(res, "/app-ui/health-status-card-v1.css");
});

export const profileSummaryCardScriptAsset = api.raw({ expose: true, method: "GET", path: "/app-ui/profile-summary-card-v1.js" }, async (_req, res) => {
  writeAsset(res, "/app-ui/profile-summary-card-v1.js");
});

export const profileSummaryCardStyleAsset = api.raw({ expose: true, method: "GET", path: "/app-ui/profile-summary-card-v1.css" }, async (_req, res) => {
  writeAsset(res, "/app-ui/profile-summary-card-v1.css");
});

function writeAsset(res: ServerResponse, path: string): void {
  try {
    writeWidgetAsset(res, path);
  } catch (error) {
    writeError(res, error, { endpoint: "mcp.widget-asset", method: "GET" });
  }
}

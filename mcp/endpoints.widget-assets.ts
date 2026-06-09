import { api } from "encore.dev/api";
import {
  healthStatusCardScript,
  healthStatusCardStyle,
  profileSummaryCardScript,
  profileSummaryCardStyle,
} from "./widget-assets.ts";

const cacheControl = "public, max-age=31536000, immutable";

export const healthStatusCardScriptAsset = api.raw({ expose: true, method: "GET", path: "/app-ui/health-status-card-v1.js" }, async (_req, res) => {
  writeAsset(res, healthStatusCardScript, "application/javascript; charset=utf-8");
});

export const healthStatusCardStyleAsset = api.raw({ expose: true, method: "GET", path: "/app-ui/health-status-card-v1.css" }, async (_req, res) => {
  writeAsset(res, healthStatusCardStyle, "text/css; charset=utf-8");
});

export const profileSummaryCardScriptAsset = api.raw({ expose: true, method: "GET", path: "/app-ui/profile-summary-card-v1.js" }, async (_req, res) => {
  writeAsset(res, profileSummaryCardScript, "application/javascript; charset=utf-8");
});

export const profileSummaryCardStyleAsset = api.raw({ expose: true, method: "GET", path: "/app-ui/profile-summary-card-v1.css" }, async (_req, res) => {
  writeAsset(res, profileSummaryCardStyle, "text/css; charset=utf-8");
});

function writeAsset(res: { writeHead: (status: number, headers: Record<string, string>) => void; end: (body: string) => void }, body: string, contentType: string): void {
  res.writeHead(200, {
    "cache-control": cacheControl,
    "content-type": contentType,
    "cross-origin-resource-policy": "cross-origin",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });
  res.end(body);
}

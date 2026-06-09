import { serviceName } from "../../shared/service-info.ts";
import { defineToolResultCardWidget } from "./tool-result-card.ts";

export const healthStatusCardUri = "ui://widget/health-status-card-v2.html";
export const healthStatusCardStylePath = "/app-ui/health-status-card-v1.css";
export const healthStatusCardScriptPath = "/app-ui/health-status-card-v1.js";

export const healthStatusCardWidget = defineToolResultCardWidget({
  resourceUri: healthStatusCardUri,
  name: "health-status-card",
  title: "Health Status Card",
  description: "Renderable UI resource for service health.",
  widgetDescription: "Shows the current MCP service health result.",
  stylePath: healthStatusCardStylePath,
  scriptPath: healthStatusCardScriptPath,
  theme: {
    pageBackground: "#f6f1e8",
    cardBackground: "linear-gradient(135deg, #fffaf0, #e8f3ed)",
    borderColor: "#d6c8b4",
    textColor: "#1f2933",
    mutedColor: "#6b7280",
    accentColor: "#173f35",
    accentTextColor: "#f8f3e8",
  },
  header: {
    eyebrow: "MCP Service",
    title: "Health status",
    subtitle: "The service status card is ready.",
  },
  status: {
    path: "status",
    fallback: "ready",
    okValue: "ok",
    okSummary: "The MCP endpoint is reachable and returning live status data.",
    waitingSummary: "The component is mounted and waiting for a live tool result.",
  },
  fields: [
    { label: "Service", id: "service", path: "service.name", fallback: serviceName },
    { label: "Timestamp", id: "timestamp", path: "timestamp", fallback: "Waiting for tool data" },
  ],
});

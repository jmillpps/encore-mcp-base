import { serviceName } from "../shared/service-info.ts";

export const healthStatusCardStylePath = "/app-ui/health-status-card-v1.css";
export const healthStatusCardScriptPath = "/app-ui/health-status-card-v1.js";
export const profileSummaryCardStylePath = "/app-ui/profile-summary-card-v1.css";
export const profileSummaryCardScriptPath = "/app-ui/profile-summary-card-v1.js";

export const healthStatusCardStyle = `
:root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; background: #f6f1e8; color: #1f2933; }
main { min-height: 100vh; box-sizing: border-box; padding: 24px; display: grid; place-items: center; }
section { width: min(100%, 520px); border: 1px solid #d6c8b4; border-radius: 22px; background: linear-gradient(135deg, #fffaf0, #e8f3ed); box-shadow: 0 18px 50px rgb(31 41 51 / 14%); padding: 24px; }
p { margin: 0; }
.eyebrow { color: #7c5e31; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
h1 { margin: 12px 0 8px; font-size: clamp(28px, 7vw, 44px); line-height: .95; letter-spacing: -.05em; }
.status { display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; border-radius: 999px; background: #173f35; color: #f8f3e8; padding: 10px 14px; font-weight: 700; }
.dot { width: 10px; height: 10px; border-radius: 999px; background: #8ee6a8; box-shadow: 0 0 0 6px rgb(142 230 168 / 18%); }
dl { display: grid; grid-template-columns: auto 1fr; gap: 10px 16px; margin: 22px 0 0; font-size: 14px; }
dt { color: #6b7280; }
dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
`.trim();

export const healthStatusCardScript = `
(function () {
  const fallbackServiceName = ${JSON.stringify(serviceName)};
  const bridge = globalThis.openai;

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function initialData() {
    return bridge?.toolOutput ?? bridge?.structuredContent ?? bridge?.toolResponseMetadata?.mcp_tool_result?.structuredContent ?? bridge?.toolResponseMetadata?.call_tool_result?.structuredContent ?? {};
  }

  function applyData(data) {
    const source = data && typeof data === "object" ? data : {};
    const service = typeof source.service?.name === "string" ? source.service.name : fallbackServiceName;
    const status = typeof source.status === "string" ? source.status : "ready";
    const timestamp = typeof source.timestamp === "string" ? source.timestamp : "Waiting for tool data";
    setText("#service", service);
    setText("#status", status);
    setText("#timestamp", timestamp);
    setText("#summary", status === "ok" ? "The MCP endpoint is reachable and returning live status data." : "The component is mounted and waiting for a live tool result.");
  }

  applyData(initialData());

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.jsonrpc !== "2.0") return;
    if (message.method !== "ui/notifications/tool-result") return;
    applyData(message.params?.structuredContent ?? {});
  }, { passive: true });
}());
`.trim();

export const profileSummaryCardStyle = `
:root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; background: #eef4f8; color: #15222f; }
main { min-height: 100vh; box-sizing: border-box; padding: 24px; display: grid; place-items: center; }
section { width: min(100%, 520px); border: 1px solid #bfd3e0; border-radius: 24px; background: linear-gradient(145deg, #ffffff, #dcecf4); box-shadow: 0 22px 60px rgb(21 34 47 / 14%); padding: 24px; }
.avatar { width: 64px; height: 64px; border-radius: 22px; display: grid; place-items: center; background: #0f766e; color: white; font-size: 28px; font-weight: 800; }
h1 { margin: 18px 0 6px; font-size: clamp(26px, 7vw, 42px); line-height: 1; letter-spacing: -.05em; }
p { margin: 0; color: #52616e; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 10px 16px; margin: 24px 0 0; font-size: 14px; }
dt { color: #6b7a86; }
dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
.verified { color: #0f766e; }
`.trim();

export const profileSummaryCardScript = `
(function () {
  const bridge = globalThis.openai;

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function initialData() {
    return bridge?.toolOutput ?? bridge?.structuredContent ?? bridge?.toolResponseMetadata?.mcp_tool_result?.structuredContent ?? bridge?.toolResponseMetadata?.call_tool_result?.structuredContent ?? {};
  }

  function applyData(data) {
    const source = data && typeof data === "object" ? data : {};
    const name = typeof source.name === "string" ? source.name : "Authenticated user";
    const email = typeof source.email === "string" ? source.email : "Waiting for profile data";
    const subject = typeof source.sub === "string" ? source.sub : "Unavailable";
    const username = typeof source.preferred_username === "string" ? source.preferred_username : "Unavailable";
    const verified = source.email_verified === true ? "Verified" : "Unavailable";
    setText("#avatar", name.trim().charAt(0).toUpperCase() || "?");
    setText("#name", name);
    setText("#email", email);
    setText("#subject", subject);
    setText("#username", username);
    setText("#verified", verified);
  }

  applyData(initialData());

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.jsonrpc !== "2.0") return;
    if (message.method !== "ui/notifications/tool-result") return;
    applyData(message.params?.structuredContent ?? {});
  }, { passive: true });
}());
`.trim();

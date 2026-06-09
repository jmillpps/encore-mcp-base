import { serviceName } from "../../shared/service-info.ts";
import { appHtmlResource } from "../app-ui.ts";

export const healthStatusCardUri = "ui://widget/health-status-card-v1.html";

const healthStatusCardHtml = `
<main>
  <section>
    <p class="eyebrow">MCP Service</p>
    <h1>Health status</h1>
    <p id="summary">The service status card is ready.</p>
    <p class="status"><span class="dot"></span><span id="status">ready</span></p>
    <dl>
      <dt>Service</dt><dd id="service">${serviceName}</dd>
      <dt>Timestamp</dt><dd id="timestamp">Waiting for tool data</dd>
    </dl>
  </section>
</main>
<style>
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
</style>
<script type="module">
      const applyData = (data = {}) => {
      const service = typeof data.service?.name === "string" ? data.service.name : "${serviceName}";
      const status = typeof data.status === "string" ? data.status : "ready";
      const timestamp = typeof data.timestamp === "string" ? data.timestamp : "Waiting for tool data";
      document.querySelector("#service").textContent = service;
      document.querySelector("#status").textContent = status;
      document.querySelector("#timestamp").textContent = timestamp;
      document.querySelector("#summary").textContent = status === "ok" ? "The MCP endpoint is reachable and returning live status data." : "The component is mounted and waiting for a live tool result.";
      };
      applyData(globalThis.openai?.toolOutput ?? globalThis.openai?.structuredContent ?? {});
      window.addEventListener("message", (event) => {
        if (event.source !== window.parent) return;
        const message = event.data;
        if (!message || message.jsonrpc !== "2.0") return;
        if (message.method !== "ui/notifications/tool-result") return;
        applyData(message.params?.structuredContent ?? {});
      }, { passive: true });
</script>
`.trim();

export const healthStatusCardResource = appHtmlResource({
  uri: healthStatusCardUri,
  name: "health-status-card",
  title: "Health Status Card",
  description: "Renderable UI resource for service health.",
  html: healthStatusCardHtml,
  widget: {
    description: "Shows the current MCP service health result.",
    prefersBorder: true,
    csp: { connectDomains: [], resourceDomains: [] },
  },
});

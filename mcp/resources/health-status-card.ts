import { serviceName } from "../../shared/service-info.ts";
import { appHtmlResource } from "../app-ui.ts";
import { healthStatusCardScriptPath, healthStatusCardStylePath } from "../widget-assets.ts";

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
<link rel="stylesheet" href="${healthStatusCardStylePath}">
<script src="${healthStatusCardScriptPath}"></script>
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

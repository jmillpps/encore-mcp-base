import { identityProfileScopes } from "../../auth/scopes.ts";
import { defineWidget, scriptAsset, styleAsset } from "./widget-definition.ts";

export const profileSummaryCardUri = "ui://widget/profile-summary-card-v1.html";
export const profileSummaryCardStylePath = "/app-ui/profile-summary-card-v1.css";
export const profileSummaryCardScriptPath = "/app-ui/profile-summary-card-v1.js";

export const profileSummaryCardWidget = defineWidget({
  resourceUri: profileSummaryCardUri,
  name: "profile-summary-card",
  title: "Profile Summary Card",
  description: "Renderable UI resource for the authenticated identity profile.",
  requiredScopes: [...identityProfileScopes],
  markup: `
<main>
  <section>
    <div class="avatar" id="avatar">?</div>
    <h1 id="name">Authenticated user</h1>
    <p id="email">Waiting for profile data</p>
    <dl>
      <dt>Subject</dt><dd id="subject">Unavailable</dd>
      <dt>Username</dt><dd id="username">Unavailable</dd>
      <dt>Email status</dt><dd id="verified" class="verified">Unavailable</dd>
    </dl>
  </section>
</main>
`,
  assets: [
    styleAsset(profileSummaryCardStylePath, `
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
`.trim()),
    scriptAsset(profileSummaryCardScriptPath, `
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
`.trim()),
  ],
  widget: {
    description: "Shows the authenticated OpenID Connect profile returned by the service.",
    prefersBorder: true,
    csp: { connectDomains: [], resourceDomains: [] },
  },
});

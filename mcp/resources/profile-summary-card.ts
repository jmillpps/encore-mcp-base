import { identityProfileScopes } from "../../auth/scopes.ts";
import { appHtmlResource } from "../app-ui.ts";

export const profileSummaryCardUri = "ui://widget/profile-summary-card-v1.html";

const profileSummaryCardHtml = `
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
<style>
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
</style>
<script type="module">
      const applyData = (data = {}) => {
      const name = typeof data.name === "string" ? data.name : "Authenticated user";
      const email = typeof data.email === "string" ? data.email : "Waiting for profile data";
      const subject = typeof data.sub === "string" ? data.sub : "Unavailable";
      const username = typeof data.preferred_username === "string" ? data.preferred_username : "Unavailable";
      const verified = data.email_verified === true ? "Verified" : "Unavailable";
      document.querySelector("#avatar").textContent = name.trim().charAt(0).toUpperCase() || "?";
      document.querySelector("#name").textContent = name;
      document.querySelector("#email").textContent = email;
      document.querySelector("#subject").textContent = subject;
      document.querySelector("#username").textContent = username;
      document.querySelector("#verified").textContent = verified;
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

export const profileSummaryCardResource = appHtmlResource({
  uri: profileSummaryCardUri,
  name: "profile-summary-card",
  title: "Profile Summary Card",
  description: "Renderable UI resource for the authenticated identity profile.",
  html: profileSummaryCardHtml,
  requiredScopes: [...identityProfileScopes],
  widget: {
    description: "Shows the authenticated OpenID Connect profile returned by the service.",
    prefersBorder: true,
    csp: { connectDomains: [], resourceDomains: [] },
  },
});

import { identityProfileScopes } from "../../auth/scopes.ts";
import { appHtmlResource } from "../app-ui.ts";
import { profileSummaryCardScriptPath, profileSummaryCardStylePath } from "../widget-assets.ts";

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
<link rel="stylesheet" href="${profileSummaryCardStylePath}">
<script src="${profileSummaryCardScriptPath}"></script>
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

import { identityProfileScopes } from "../../auth/scopes.ts";
import { defineToolResultCardWidget } from "./tool-result-card.ts";

export const profileSummaryCardUri = "ui://widget/profile-summary-card-v1.html";
export const profileSummaryCardStylePath = "/app-ui/profile-summary-card-v1.css";
export const profileSummaryCardScriptPath = "/app-ui/profile-summary-card-v1.js";

export const profileSummaryCardWidget = defineToolResultCardWidget({
  resourceUri: profileSummaryCardUri,
  name: "profile-summary-card",
  title: "Profile Summary Card",
  description: "Renderable UI resource for the authenticated identity profile.",
  requiredScopes: [...identityProfileScopes],
  widgetDescription: "Shows the authenticated OpenID Connect profile returned by the service.",
  stylePath: profileSummaryCardStylePath,
  scriptPath: profileSummaryCardScriptPath,
  theme: {
    pageBackground: "#eef4f8",
    cardBackground: "linear-gradient(145deg, #ffffff, #dcecf4)",
    borderColor: "#bfd3e0",
    textColor: "#15222f",
    mutedColor: "#52616e",
    accentColor: "#0f766e",
    accentTextColor: "white",
  },
  header: {
    title: "Authenticated user",
    titlePath: "name",
    titleFallback: "Authenticated user",
    subtitlePath: "email",
    subtitleFallback: "Waiting for profile data",
    avatarPath: "name",
    avatarFallback: "?",
  },
  fields: [
    { label: "Subject", id: "subject", path: "sub", fallback: "Unavailable" },
    { label: "Username", id: "username", path: "preferred_username", fallback: "Unavailable" },
    { label: "Email status", id: "verified", path: "email_verified", fallback: "Unavailable", format: "verified" },
  ],
});

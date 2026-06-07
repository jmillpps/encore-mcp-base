import { api } from "encore.dev/api";

const privacyPolicy = [
  "GPT MCP Service Privacy Policy",
  "",
  "This private service processes OAuth profile requests, OAuth session requests, and MCP tool requests for configured ChatGPT clients.",
  "The service receives OAuth tokens, OAuth callback data, MCP requests, and Actions requests needed to answer the signed-in user's request.",
  "The service stores OAuth authorization records, access token records, refresh token records, upstream authorization records, and MCP session records in its configured runtime store.",
  "The service uses AWS Systems Manager Parameter Store for runtime configuration and secrets.",
  "Personal information is used for authentication, authorization, and requested service responses.",
  "Access is limited to configured OAuth clients and the deployed operator environment.",
  "Contact the service operator for access, deletion, and operational requests.",
].join("\n");

export const privacy = api.raw({ expose: true, method: "GET", path: "/privacy" }, async (_req, res) => {
  res.writeHead(200, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "public, max-age=300",
  });
  res.end(privacyPolicy);
});

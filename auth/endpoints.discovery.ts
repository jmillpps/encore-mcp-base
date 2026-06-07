import type { ServerResponse } from "node:http";
import { api } from "encore.dev/api";
import { rejectAccessTokenQuery } from "../shared/access-token-query.ts";
import { readConfig } from "../shared/config.ts";
import { writeJson } from "../shared/http.ts";
import { loadClients } from "./clients.ts";
import { authorizationServerMetadata, openidConfiguration, protectedResourceMetadata } from "./discovery.ts";
import { writeOAuthError } from "./oauth-errors.ts";

export const openid = api.raw({ expose: true, method: "GET", path: "/.well-known/openid-configuration" }, async (req, res) => {
  try {
    rejectAccessTokenQuery(req.url);
    const config = readConfig();
    writeJson(res, 200, openidConfiguration(config, loadClients(config)));
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.discovery.openid", method: "GET" });
  }
});

export const oauthServer = api.raw({ expose: true, method: "GET", path: "/.well-known/oauth-authorization-server" }, async (req, res) => {
  try {
    rejectAccessTokenQuery(req.url);
    const config = readConfig();
    writeJson(res, 200, authorizationServerMetadata(config, loadClients(config)));
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.discovery.server", method: "GET" });
  }
});

export const protectedResource = api.raw({ expose: true, method: "GET", path: "/.well-known/oauth-protected-resource" }, async (req, res) => {
  await writeProtectedResource(req.url, res, "oauth.discovery.resource");
});

export const protectedResourceMcp = api.raw({ expose: true, method: "GET", path: "/.well-known/oauth-protected-resource/mcp" }, async (req, res) => {
  await writeProtectedResource(req.url, res, "oauth.discovery.resource.mcp");
});

async function writeProtectedResource(url: string | undefined, res: ServerResponse, endpoint: string): Promise<void> {
  try {
    rejectAccessTokenQuery(url);
    const config = readConfig();
    writeJson(res, 200, protectedResourceMetadata(config));
  } catch (error) {
    writeOAuthError(res, error, { endpoint, method: "GET" });
  }
}

import type { ServerResponse } from "node:http";
import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { writeJson } from "../shared/http.ts";
import { loadClients } from "./clients.ts";
import { authorizationServerMetadata, openidConfiguration, protectedResourceMetadata } from "./discovery.ts";
import { writeOAuthError } from "./oauth-errors.ts";

export const openid = api.raw({ expose: true, method: "GET", path: "/.well-known/openid-configuration" }, async (_req, res) => {
  try {
    const config = readConfig();
    writeJson(res, 200, openidConfiguration(config, loadClients(config)));
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.discovery.openid", method: "GET" });
  }
});

export const oauthServer = api.raw({ expose: true, method: "GET", path: "/.well-known/oauth-authorization-server" }, async (_req, res) => {
  try {
    const config = readConfig();
    writeJson(res, 200, authorizationServerMetadata(config, loadClients(config)));
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.discovery.server", method: "GET" });
  }
});

export const protectedResource = api.raw({ expose: true, method: "GET", path: "/.well-known/oauth-protected-resource" }, async (_req, res) => {
  await writeProtectedResource(res, "oauth.discovery.resource");
});

export const protectedResourceMcp = api.raw({ expose: true, method: "GET", path: "/.well-known/oauth-protected-resource/mcp" }, async (_req, res) => {
  await writeProtectedResource(res, "oauth.discovery.resource.mcp");
});

async function writeProtectedResource(res: ServerResponse, endpoint: string): Promise<void> {
  try {
    const config = readConfig();
    writeJson(res, 200, protectedResourceMetadata(config, loadClients(config)));
  } catch (error) {
    writeOAuthError(res, error, { endpoint, method: "GET" });
  }
}

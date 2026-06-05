import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { writeJson } from "../shared/http.ts";
import { loadClients } from "./clients.ts";
import { authorizationServerMetadata, openidConfiguration, protectedResourceMetadata } from "./discovery.ts";
import { writeOAuthError } from "./oauth-errors.ts";
import { jwks } from "./tokens/jwks.ts";

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
  try {
    const config = readConfig();
    writeJson(res, 200, protectedResourceMetadata(config, loadClients(config)));
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.discovery.resource", method: "GET" });
  }
});

export const jwksEndpoint = api.raw({ expose: true, method: "GET", path: "/oauth/jwks" }, async (_req, res) => {
  try {
    writeJson(res, 200, jwks(readConfig()));
  } catch (error) {
    writeOAuthError(res, error, { endpoint: "oauth.jwks", method: "GET" });
  }
});

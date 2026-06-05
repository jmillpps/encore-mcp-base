import { api } from "encore.dev/api";
import { readConfig } from "../shared/config.ts";
import { writeJson } from "../shared/http.ts";
import { authorizationServerMetadata, openidConfiguration, protectedResourceMetadata } from "./discovery.ts";
import { jwks } from "./tokens/jwks.ts";

export const openid = api.raw({ expose: true, method: "GET", path: "/.well-known/openid-configuration" }, async (_req, res) => {
  writeJson(res, 200, openidConfiguration(readConfig()));
});

export const oauthServer = api.raw({ expose: true, method: "GET", path: "/.well-known/oauth-authorization-server" }, async (_req, res) => {
  writeJson(res, 200, authorizationServerMetadata(readConfig()));
});

export const protectedResource = api.raw({ expose: true, method: "GET", path: "/.well-known/oauth-protected-resource" }, async (_req, res) => {
  writeJson(res, 200, protectedResourceMetadata(readConfig()));
});

export const jwksEndpoint = api.raw({ expose: true, method: "GET", path: "/oauth/jwks" }, async (_req, res) => {
  writeJson(res, 200, jwks(readConfig()));
});

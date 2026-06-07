import assert from "node:assert/strict";
import test from "node:test";
import { assertRedirectUri, loadClients } from "../../auth/clients.ts";
import { parseClientJson } from "../../auth/client-registry.ts";
import { sha256Base64Url } from "../../shared/crypto.ts";
import { readConfig } from "../../shared/config.ts";

test("local client registry carries explicit classes and PKCE policies", () => {
  const config = readConfig({ PUBLIC_ISSUER_URL: "http://localhost:4000" });
  const clients = loadClients(config, {});
  const local = clients.find((client) => client.clientId === "local-test");
  const apps = clients.find((client) => client.clientId === "gpt-apps-mcp");
  assert.equal(local?.clientClass, "local-test");
  assert.equal(local?.pkcePolicy, "optional");
  assert.equal(apps?.clientClass, "gpt-apps-mcp");
  assert.equal(apps?.pkcePolicy, "required");
});

test("client registry accepts validated production metadata", () => {
  const clients = parseClientJson(JSON.stringify([clientRecord()]), true);
  assert.equal(clients.length, 1);
  assert.equal(clients[0]?.clientId, "actions-client");
  assert.equal(clients[0]?.clientClass, "gpt-actions");
  assert.equal(clients[0]?.pkcePolicy, "optional");
  assert.deepEqual(clients[0]?.allowedScopes, ["openid", "profile", "email"]);
});

test("client registry canonicalizes resource URLs for exact audience binding", () => {
  const clients = parseClientJson(JSON.stringify([clientRecord({ allowedResources: ["https://mcp.example.test/", "https://api.example.test/actions/"] })]), true);
  assert.deepEqual(clients[0]?.allowedResources, ["https://mcp.example.test", "https://api.example.test/actions"]);
  assert.deepEqual(clients[0]?.redirectUris, ["https://chatgpt.com/aip/g-prod/oauth/callback"]);
});

test("client registry preserves redirect URI text for exact callback matching", () => {
  const redirectUri = "https://chatgpt.com:443/aip/g-prod/oauth/callback";
  const client = parseClientJson(JSON.stringify([clientRecord({ redirectUris: [redirectUri] })]), true)[0];
  assert.ok(client);
  assert.equal(client.redirectUris[0], redirectUri);
  assert.doesNotThrow(() => assertRedirectUri(client, redirectUri));
  assert.throws(() => assertRedirectUri(client, new URL(redirectUri).toString()), /redirect_uri/);
});

test("client registry allows production loopback HTTP redirect URIs", () => {
  const redirectUris = ["http://127.0.0.1:3000/callback", "http://localhost:3000/callback"];
  const clients = parseClientJson(JSON.stringify([clientRecord({ redirectUris })]), true);
  assert.deepEqual(clients[0]?.redirectUris, redirectUris);
});

test("client registry rejects unsafe or malformed metadata", () => {
  assert.throws(() => parseClientJson("{}", true), /non-empty array/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ clientSecretHash: "bad" })]), true), /SHA-256/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ displayName: "GPT\nActions" })]), true), /displayName/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ redirectUris: ["https://*.example.test/callback"] })]), true), /wildcards/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ redirectUris: ["http://public.example.test/callback"] })]), true), /https or localhost/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ redirectUris: [" https://chatgpt.com/callback"] })]), true), /whitespace/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ redirectUris: ["https://user:pass@chatgpt.com/callback"] })]), true), /credentials/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ tokenEndpointAuthMethod: "none" })]), true), /not supported/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ clientClass: "gpt-apps-mcp", pkcePolicy: "optional" })]), true), /PKCE/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ allowedResources: ["http://api.example.test"] })]), true), /https/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ allowedResources: ["https://user:pass@api.example.test"] })]), true), /credentials/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ shadowPolicy: "ignored" })]), true), /unsupported fields/);
  assert.throws(
    () => parseClientJson(JSON.stringify([clientRecord({ redirectUris: ["https://chatgpt.com/aip/g-prod/oauth/callback", "https://chatgpt.com/aip/g-prod/oauth/callback"] })]), true),
    /duplicates/,
  );
  assert.throws(
    () => parseClientJson(JSON.stringify([clientRecord({ allowedResources: ["https://api.example.test/actions", "https://api.example.test/actions/"] })]), true),
    /duplicates/,
  );
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord(), clientRecord()]), true), /duplicates/);
});

function clientRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clientId: "actions-client",
    clientSecretHash: sha256Base64Url("actions-secret"),
    displayName: "GPT Actions",
    redirectUris: ["https://chatgpt.com/aip/g-prod/oauth/callback"],
    allowedScopes: ["openid", "profile", "email"],
    allowedResources: ["https://api.example.test/actions"],
    tokenEndpointAuthMethod: "client_secret_post",
    pkcePolicy: "optional",
    clientClass: "gpt-actions",
    ...overrides,
  };
}

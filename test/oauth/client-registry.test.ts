import assert from "node:assert/strict";
import test from "node:test";
import { loadClients } from "../../auth/clients.ts";
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
  assert.equal(clients[0]?.clientId, "gpt-actions-prod");
  assert.equal(clients[0]?.clientClass, "gpt-actions");
  assert.deepEqual(clients[0]?.allowedScopes, ["openid", "profile", "email"]);
});

test("client registry rejects unsafe or malformed metadata", () => {
  assert.throws(() => parseClientJson("{}", true), /non-empty array/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ clientSecretHash: "bad" })]), true), /SHA-256/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ redirectUris: ["https://*.example.test/callback"] })]), true), /wildcards/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord({ allowedResources: ["http://api.example.test"] })]), true), /https/);
  assert.throws(() => parseClientJson(JSON.stringify([clientRecord(), clientRecord()]), true), /duplicates/);
});

function clientRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clientId: "gpt-actions-prod",
    clientSecretHash: sha256Base64Url("prod-secret"),
    displayName: "GPT Actions Production",
    redirectUris: ["https://chatgpt.com/aip/g-prod/oauth/callback"],
    allowedScopes: ["openid", "profile", "email"],
    allowedResources: ["https://api.example.test/actions"],
    tokenEndpointAuthMethod: "client_secret_post",
    pkcePolicy: "required",
    clientClass: "gpt-actions",
    ...overrides,
  };
}

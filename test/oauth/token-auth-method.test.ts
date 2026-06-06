import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertClientSecret } from "../../auth/clients.ts";
import { readClientCredentials } from "../../auth/client-auth.ts";
import { handleTokenGrant } from "../../auth/token.ts";
import { DiskOAuthStore } from "../../auth/storage/disk-store.ts";
import type { OAuthClient, TokenEndpointAuthMethod } from "../../auth/client-types.ts";
import { staticUser } from "../../auth/static-user.ts";
import { readConfig, type ServiceConfig } from "../../shared/config.ts";
import { sha256Base64Url } from "../../shared/crypto.ts";
import { ServiceError } from "../../shared/errors.ts";

test("authorization code grant accepts client_secret_basic only for basic clients", async (t) => {
  const { config, store, client } = await setup(t, "client_secret_basic");
  const code = await issueCode(store, config, client);
  const form = tokenForm(code, config);
  await assert.rejects(
    () => handleTokenGrant(config, store, [client], postCredentials(form, client, "basic-secret"), undefined),
    (error) => error instanceof ServiceError && error.code === "invalid_client",
  );
  const response = await handleTokenGrant(config, store, [client], form, basicCredentials(client.clientId, "basic-secret"));
  assert.equal(response.token_type, "bearer");
  assert.ok(response.access_token);
  const lowerCaseCode = await issueCode(store, config, client);
  const lowerCaseResponse = await handleTokenGrant(config, store, [client], tokenForm(lowerCaseCode, config), basicCredentials(client.clientId, "basic-secret", "basic"));
  assert.equal(lowerCaseResponse.token_type, "bearer");
});

test("authorization code grant rejects client_secret_basic for post clients", async (t) => {
  const { config, store, client } = await setup(t, "client_secret_post");
  const code = await issueCode(store, config, client);
  const form = tokenForm(code, config);
  await assert.rejects(
    () => handleTokenGrant(config, store, [client], form, basicCredentials(client.clientId, "basic-secret")),
    (error) => error instanceof ServiceError && error.code === "invalid_client",
  );
  const response = await handleTokenGrant(config, store, [client], postCredentials(form, client, "basic-secret"), undefined);
  assert.equal(response.token_type, "bearer");
  assert.doesNotThrow(() => assertClientSecret(client, "basic-secret"));
});

test("client_secret_basic rejects malformed credential encoding", () => {
  assertInvalidClient(() => readClientCredentials(new URLSearchParams(), "Basic %%%"));
  assertInvalidClient(() => readClientCredentials(new URLSearchParams(), "Basic abcd=="));
  assertInvalidClient(() => readClientCredentials(new URLSearchParams(), `Basic ${Buffer.from([0xff, 0x3a, 0x78]).toString("base64")}`));
  assertInvalidClient(() => readClientCredentials(new URLSearchParams(), `Basic ${Buffer.from("%E0%A4%A:secret").toString("base64")}`));
});

async function setup(t: TestContextLike, method: TokenEndpointAuthMethod): Promise<{ config: ServiceConfig; store: DiskOAuthStore; client: OAuthClient }> {
  const dir = await mkdtemp(join(tmpdir(), "mcp-token-auth-method-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const config = readConfig({ PUBLIC_ISSUER_URL: "http://localhost:4000", OAUTH_STORE_PATH: join(dir, "store.json") });
  const client = {
    clientId: "basic-test",
    clientSecretHash: sha256Base64Url("basic-secret"),
    displayName: "Basic Test",
    redirectUris: ["http://localhost:4000/callback"],
    allowedScopes: ["openid", "profile", "email"],
    allowedResources: [config.actionsAudience],
    tokenEndpointAuthMethod: method,
    pkcePolicy: "optional" as const,
    clientClass: "local-test",
  };
  return { config, store: new DiskOAuthStore(config.oauthStorePath), client };
}

async function issueCode(store: DiskOAuthStore, config: ServiceConfig, client: OAuthClient): Promise<string> {
  return store.createAuthorizationCode({
    clientId: client.clientId,
    redirectUri: "http://localhost:4000/callback",
    resource: config.actionsAudience,
    scopes: ["openid"],
    userSub: staticUser.sub,
    ttlSeconds: 300,
  });
}

function tokenForm(code: string, config: ServiceConfig): URLSearchParams {
  return new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: "http://localhost:4000/callback",
    resource: config.actionsAudience,
  });
}

function postCredentials(form: URLSearchParams, client: OAuthClient, secret: string): URLSearchParams {
  const withCredentials = new URLSearchParams(form);
  withCredentials.set("client_id", client.clientId);
  withCredentials.set("client_secret", secret);
  return withCredentials;
}

function basicCredentials(clientId: string, secret: string, scheme = "Basic"): string {
  return `${scheme} ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(secret)}`).toString("base64")}`;
}

function assertInvalidClient(fn: () => unknown): void {
  assert.throws(fn, (error) => error instanceof ServiceError && error.code === "invalid_client");
}

interface TestContextLike {
  after(fn: () => Promise<void>): void;
}

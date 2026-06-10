import assert from "node:assert/strict";
import test from "node:test";
import { DynamoDbOAuthStore } from "../../auth/storage/dynamodb/oauth-store.ts";
import { DynamoDbRateLimitStore } from "../../auth/storage/dynamodb/rate-limit-store.ts";
import { sha256Base64Url } from "../../shared/crypto.ts";
import { readConfig } from "../../shared/config.ts";
import { FakeDynamoDbClient } from "../support/fake-dynamodb-client.ts";
import { testUserProfile } from "../support/user-profile.ts";

test("DynamoDB authorization codes are single use and store only code hashes", async () => {
  const client = new FakeDynamoDbClient();
  const store = new DynamoDbOAuthStore(config(), client);
  const code = await store.createAuthorizationCode({
    clientId: "actions-client",
    redirectUri: "https://chatgpt.com/example/oauth/callback",
    resource: "https://api.example.test/actions",
    scopes: ["openid", "profile", "email"],
    user: testUserProfile,
    ttlSeconds: 300,
  });
  const consumed = await store.consumeAuthorizationCode(code, undefined, {
    clientId: "actions-client",
    redirectUri: "https://chatgpt.com/example/oauth/callback",
    resource: "https://api.example.test/actions",
  });
  assert.equal(consumed.user.email, "user@example.test");
  await assert.rejects(() => store.consumeAuthorizationCode(code, undefined, {
    clientId: "actions-client",
    redirectUri: "https://chatgpt.com/example/oauth/callback",
    resource: "https://api.example.test/actions",
  }), /invalid grant/);
  assert.equal(client.snapshotText().includes(code), false);
  assert.match(client.snapshotText(), new RegExp(escapeRegExp(sha256Base64Url(code))));
});

test("DynamoDB refresh rotation rejects replayed tokens through family metadata", async () => {
  const client = new FakeDynamoDbClient();
  const store = new DynamoDbOAuthStore(config(), client);
  const firstToken = await store.createRefreshToken({
    clientId: "actions-client",
    user: testUserProfile,
    resource: "https://api.example.test/actions",
    scopes: ["openid"],
    authTime: 1,
    ttlSeconds: 300,
  });
  const rotated = await store.rotateRefreshToken(firstToken, "actions-client", 300, "https://api.example.test/actions");
  assert.notEqual(rotated.newToken, firstToken);
  await assert.rejects(() => store.rotateRefreshToken(firstToken, "actions-client", 300, "https://api.example.test/actions"), /invalid grant/);
  await assert.rejects(() => store.rotateRefreshToken(rotated.newToken, "actions-client", 300, "https://api.example.test/actions"), /invalid grant/);
  assert.equal(client.snapshotText().includes(firstToken), false);
  assert.equal(client.snapshotText().includes(rotated.newToken), false);
});

test("DynamoDB MCP sessions reject duplicate request ids without raw id storage", async () => {
  const client = new FakeDynamoDbClient();
  const store = new DynamoDbOAuthStore(config(), client);
  await store.saveMcpSession({
    sessionIdHash: "session_hash",
    clientId: "mcp-client",
    protocolVersion: "2025-11-25",
    createdAt: 1,
    lastSeenAt: 1,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    requestIdHashes: [],
  });
  assert.deepEqual(await store.touchMcpSession("session_hash", "2025-11-25", true), { initialized: true });
  assert.deepEqual(await store.touchMcpSession("session_hash", "2025-11-25"), { initialized: true });
  assert.equal(await store.reserveMcpRequestId("session_hash", sha256Base64Url("request-1")), true);
  assert.equal(await store.reserveMcpRequestId("session_hash", sha256Base64Url("request-1")), false);
  assert.equal(client.snapshotText().includes("request-1"), false);
});

test("DynamoDB rate limit store hashes bucket subjects and enforces caps", async () => {
  const client = new FakeDynamoDbClient();
  const store = new DynamoDbRateLimitStore(config(), client);
  await store.hit("oauth-token:client-secret-value", 60, 1);
  await assert.rejects(() => store.hit("oauth-token:client-secret-value", 60, 1), /rate limit exceeded/);
  assert.equal(client.snapshotText().includes("client-secret-value"), false);
  assert.match(client.snapshotText(), new RegExp(escapeRegExp(sha256Base64Url("oauth-token:client-secret-value"))));
});

function config() {
  return readConfig({
    PUBLIC_ISSUER_URL: "http://localhost:4000",
    OAUTH_STORE_BACKEND: "dynamodb",
    OAUTH_DYNAMODB_TABLE_NAME: "operator-mcp-state",
    OAUTH_DYNAMODB_REGION: "us-east-1",
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

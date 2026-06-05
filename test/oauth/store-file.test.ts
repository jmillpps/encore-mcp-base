import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DiskOAuthStore } from "../../auth/storage/disk-store.ts";
import { DiskRateLimitStore } from "../../auth/storage/rate-limit-store.ts";

const validHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("OAuth store persists PRD field names and reloads records through the strict codec", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  const code = await new DiskOAuthStore(path).createAuthorizationCode({
    clientId: "local-test",
    redirectUri: "http://localhost:4000/callback",
    resource: "http://localhost:4000/actions",
    scopes: ["openid", "profile", "email"],
    nonce: "nonce-value",
    userSub: "user_justin_miller",
    ttlSeconds: 300,
  });
  await new DiskOAuthStore(path).consumeAuthorizationCode(code, undefined, {
    clientId: "local-test",
    redirectUri: "http://localhost:4000/callback",
    resource: "http://localhost:4000/actions",
  });
  const refreshToken = await new DiskOAuthStore(path).createRefreshToken({
    clientId: "local-test",
    userSub: "user_justin_miller",
    resource: "http://localhost:4000/actions",
    scopes: ["openid"],
    authTime: 1,
    ttlSeconds: 300,
  });
  await new DiskOAuthStore(path).rotateRefreshToken(refreshToken, "local-test", 300);
  await new DiskRateLimitStore(path).hit("oauth-token:local-test", 60, 120);
  const persisted = await readFile(path, "utf8");
  assert.match(persisted, /"code_hash"/);
  assert.match(persisted, /"scopes_json"/);
  assert.match(persisted, /"auth_time"/);
  assert.match(persisted, /"nonce"/);
  assert.match(persisted, /"rotated_from_hash"/);
  assert.match(persisted, /"reset_at"/);
  assert.equal(persisted.includes("codeHash"), false);
  assert.equal(persisted.includes("rotatedToHash"), false);
  assert.equal(persisted.includes("resetAt"), false);
});

test("OAuth store rejects malformed JSON and unexpected record shapes", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-corrupt-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  await writeFile(path, "{", "utf8");
  await assert.rejects(() => new DiskOAuthStore(path).createRefreshToken(refreshInput()), /store file is malformed/);
  await writeFile(path, JSON.stringify({ authorizationCodes: { [validHash]: { code_hash: validHash, unexpected: true } } }), "utf8");
  await assert.rejects(() => new DiskOAuthStore(path).createRefreshToken(refreshInput()), /store file is malformed/);
  await writeFile(
    path,
    JSON.stringify({ authorizationCodes: { [validHash]: authorizationCodeDiskRecord({ nonce: "bad nonce" }) } }),
    "utf8",
  );
  await assert.rejects(() => new DiskOAuthStore(path).createRefreshToken(refreshInput()), /store file is malformed/);
  await writeFile(
    path,
    JSON.stringify({ authorizationCodes: { [validHash]: authorizationCodeDiskRecord({ auth_time: 2, created_at: 1 }) } }),
    "utf8",
  );
  await assert.rejects(() => new DiskOAuthStore(path).createRefreshToken(refreshInput()), /store file is malformed/);
  await writeFile(
    path,
    JSON.stringify({ refreshTokens: { [validHash]: refreshTokenDiskRecord({ auth_time: 2, created_at: 1 }) } }),
    "utf8",
  );
  await assert.rejects(() => new DiskOAuthStore(path).createRefreshToken(refreshInput()), /store file is malformed/);
});

test("OAuth store rejects traversal and non-json paths", () => {
  assert.throws(() => new DiskOAuthStore("../oauth-store.json"), /store path cannot traverse upward/);
  assert.throws(() => new DiskOAuthStore(`${tmpdir()}/../oauth-store.json`), /store path cannot traverse upward/);
  assert.throws(() => new DiskOAuthStore("oauth-store.txt"), /store path must end with .json/);
});

function refreshInput() {
  return {
    clientId: "local-test",
    userSub: "user_justin_miller",
    resource: "http://localhost:4000/actions",
    scopes: ["openid"],
    authTime: 1,
    ttlSeconds: 300,
  };
}

function authorizationCodeDiskRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code_hash: validHash,
    client_id: "local-test",
    redirect_uri: "http://localhost:4000/callback",
    resource: "http://localhost:4000/actions",
    scopes_json: JSON.stringify(["openid"]),
    user_sub: "user_justin_miller",
    expires_at: 9999999999,
    auth_time: 1,
    created_at: 1,
    ...overrides,
  };
}

function refreshTokenDiskRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    token_hash: validHash,
    family_id: validHash,
    client_id: "local-test",
    user_sub: "user_justin_miller",
    resource: "http://localhost:4000/actions",
    scopes_json: JSON.stringify(["openid"]),
    expires_at: 9999999999,
    auth_time: 1,
    created_at: 1,
    ...overrides,
  };
}

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test, { type TestContext } from "node:test";
import { DiskOAuthStore } from "../../auth/storage/disk-store.ts";
import { DiskRateLimitStore } from "../../auth/storage/rate-limit-store.ts";
import { StoreFile } from "../../auth/storage/store-file.ts";
import { ServiceError } from "../../shared/errors.ts";
import { spawnStoreWorker, waitForStoreWorker, waitForStoreWorkerMarker } from "../support/store-worker.ts";

const validHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const secondValidHash = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

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
  await writeMalformedAndReject(path, { authorizationCodes: { [validHash]: authorizationCodeDiskRecord({ expires_at: 0, created_at: 1 }) } });
  await writeMalformedAndReject(path, { authorizationCodes: { [validHash]: authorizationCodeDiskRecord({ consumed_at: 0, created_at: 1 }) } });
  await writeMalformedAndReject(path, { refreshTokens: { [validHash]: refreshTokenDiskRecord({ expires_at: 0, created_at: 1 }) } });
  await writeMalformedAndReject(path, { refreshTokens: { [validHash]: refreshTokenDiskRecord({ revoked_at: 0, created_at: 1 }) } });
  await writeMalformedAndReject(path, { refreshTokens: { [validHash]: refreshTokenDiskRecord({ last_used_at: 0, created_at: 1 }) } });
  await writeMalformedAndReject(path, { mcpSessions: { [validHash]: mcpSessionDiskRecord({ last_seen_at: 0, created_at: 1 }) } });
  await writeMalformedAndReject(path, { mcpSessions: { [validHash]: mcpSessionDiskRecord({ expires_at: 0, created_at: 1 }) } });
  await writeMalformedAndReject(path, { mcpSessions: { [validHash]: mcpSessionDiskRecord({ initialized_at: 0, created_at: 1 }) } });
  await writeMalformedAndReject(path, { mcpSessions: { [validHash]: mcpSessionDiskRecord({ terminated_at: 0, created_at: 1 }) } });
});

test("OAuth store rejects traversal and non-json paths", () => {
  assert.throws(() => new DiskOAuthStore("../oauth-store.json"), /store path cannot traverse upward/);
  assert.throws(() => new DiskOAuthStore(`${tmpdir()}/../oauth-store.json`), /store path cannot traverse upward/);
  assert.throws(() => new DiskOAuthStore("oauth-store.txt"), /store path must end with .json/);
});

test("OAuth store creates parent directories before locked writes", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-directory-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "nested", "store.json");
  await new DiskOAuthStore(path).createRefreshToken(refreshInput());
  const persisted = await readFile(path, "utf8");
  assert.match(persisted, /"refreshTokens"/);
});

test("OAuth store rejects authorization, refresh, and MCP records at the expiry instant", async (t) => {
  const now = 1_800_000_000;
  freezeUnixSecond(t, now);
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-expiry-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  const store = new DiskOAuthStore(path);
  const code = await store.createAuthorizationCode({
    clientId: "local-test",
    redirectUri: "http://localhost:4000/callback",
    resource: "http://localhost:4000/actions",
    scopes: ["openid"],
    userSub: "user_justin_miller",
    ttlSeconds: 0,
  });
  await assertServiceError("invalid_grant", () =>
    store.consumeAuthorizationCode(code, undefined, {
      clientId: "local-test",
      redirectUri: "http://localhost:4000/callback",
      resource: "http://localhost:4000/actions",
    }),
  );
  const refreshToken = await store.createRefreshToken({ ...refreshInput(), ttlSeconds: 0 });
  await assertServiceError("invalid_grant", () => store.rotateRefreshToken(refreshToken, "local-test", 300));
  await store.saveMcpSession({
    sessionIdHash: validHash,
    clientId: "local-test",
    protocolVersion: "2025-11-25",
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now,
  });
  await assertServiceError("not_found", () => store.touchMcpSession(validHash, "2025-11-25"));
  await assertServiceError("not_found", () => store.terminateMcpSession(validHash));
});

test("OAuth store persists MCP session initialization state", async (t) => {
  const now = 1_800_000_100;
  freezeUnixSecond(t, now);
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-session-init-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  const store = new DiskOAuthStore(path);
  await store.saveMcpSession({
    sessionIdHash: validHash,
    clientId: "local-test",
    protocolVersion: "2025-11-25",
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + 300,
  });
  assert.deepEqual(await store.touchMcpSession(validHash, "2025-11-25"), { initialized: false });
  assert.deepEqual(await store.touchMcpSession(validHash, "2025-11-25", true), { initialized: true });
  const persisted = await readFile(path, "utf8");
  assert.match(persisted, /"initialized_at"/);
});

test("OAuth store serializes updates across store instances for the same path", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-concurrent-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  const first = new StoreFile(path);
  const second = new StoreFile(path);
  const entered = deferred();
  const release = deferred();
  const firstUpdate = first.update(async (state) => {
    state.rateLimits[validHash] = { count: 1, resetAt: 10 };
    entered.resolve();
    await release.promise;
  });
  await entered.promise;
  const secondUpdate = second.update((state) => {
    state.rateLimits[secondValidHash] = { count: 2, resetAt: 20 };
  });
  await delay(25);
  release.resolve();
  await Promise.all([firstUpdate, secondUpdate]);
  const state = await new StoreFile(path).read();
  assert.deepEqual(Object.keys(state.rateLimits).sort(), [validHash, secondValidHash].sort());
});

test("OAuth store serializes updates across processes for the same path", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-process-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  const marker = join(dir, "entered");
  const first = spawnStoreWorker(path, validHash, 1, 10, 150, marker);
  await waitForStoreWorkerMarker(marker);
  const second = spawnStoreWorker(path, secondValidHash, 2, 20, 0);
  await waitForStoreWorker(second);
  await waitForStoreWorker(first);
  const state = await new StoreFile(path).read();
  assert.deepEqual(Object.keys(state.rateLimits).sort(), [validHash, secondValidHash].sort());
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

function mcpSessionDiskRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_id_hash: validHash,
    client_id: "local-test",
    protocol_version: "2025-11-25",
    created_at: 1,
    last_seen_at: 1,
    expires_at: 9999999999,
    ...overrides,
  };
}

async function writeMalformedAndReject(path: string, value: Record<string, unknown>) {
  await writeFile(path, JSON.stringify(value), "utf8");
  await assert.rejects(() => new DiskOAuthStore(path).createRefreshToken(refreshInput()), /store file is malformed/);
}

async function assertServiceError(code: string, fn: () => Promise<unknown>): Promise<void> {
  await assert.rejects(fn, (error) => error instanceof ServiceError && error.code === code);
}

function freezeUnixSecond(t: TestContext, seconds: number): void {
  const original = Date.now;
  Date.now = () => seconds * 1000;
  t.after(() => {
    Date.now = original;
  });
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

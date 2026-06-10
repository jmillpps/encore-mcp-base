import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { nextRateLimitRecord } from "../../auth/storage/rate-limit-algorithm.ts";
import { DiskRateLimitStore } from "../../auth/storage/rate-limit-store.ts";

const strictPolicy = { windowSeconds: 60, maxRequests: 1 };

test("rate limit store hashes durable bucket keys and enforces request caps", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-rate-limit-store-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  const store = new DiskRateLimitStore(path);
  await store.hit("oauth-token:client-secret-value", strictPolicy);
  await assert.rejects(() => store.hit("oauth-token:client-secret-value", strictPolicy), /rate limit exceeded/);
  const file = await readFile(path, "utf8");
  assert.equal(file.includes("client-secret-value"), false);
  assert.match(file, /"rateLimits"/);
});

test("rate limit store resets counters after the configured window", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-rate-limit-window-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const store = new DiskRateLimitStore(join(dir, "store.json"));
  const policy = { windowSeconds: 1, maxRequests: 1 };
  await store.hit("oauth-authorize:client", policy);
  await assert.rejects(() => store.hit("oauth-authorize:client", policy), /rate limit exceeded/);
  await delay(2100);
  await store.hit("oauth-authorize:client", policy);
});

test("rate limit store prunes expired durable buckets while recording new hits", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-rate-limit-prune-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  const store = new DiskRateLimitStore(path);
  await store.hit("oauth-authorize:expired-client", { windowSeconds: 1, maxRequests: 1 });
  await delay(2100);
  await store.hit("oauth-token:fresh-client", strictPolicy);
  const state = JSON.parse(await readFile(path, "utf8")) as { rateLimits: Record<string, unknown> };
  assert.equal(Object.keys(state.rateLimits).length, 1);
});

test("sliding counter carries weighted requests from the previous window", () => {
  const policy = { windowSeconds: 10, maxRequests: 2 };
  const first = nextRateLimitRecord(undefined, policy, 100);
  const second = nextRateLimitRecord(first, policy, 101);
  assert.throws(() => nextRateLimitRecord(second, policy, 110), /rate limit exceeded/);
  assert.doesNotThrow(() => nextRateLimitRecord(second, policy, 119));
});

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { DiskRateLimitStore } from "../../auth/storage/rate-limit-store.ts";

test("rate limit store hashes durable bucket keys and enforces request caps", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-rate-limit-store-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  const store = new DiskRateLimitStore(path);
  await store.hit("oauth-token:client-secret-value", 60, 1);
  await assert.rejects(() => store.hit("oauth-token:client-secret-value", 60, 1), /rate limit exceeded/);
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
  await store.hit("oauth-authorize:client", 1, 1);
  await assert.rejects(() => store.hit("oauth-authorize:client", 1, 1), /rate limit exceeded/);
  await delay(1100);
  await store.hit("oauth-authorize:client", 1, 1);
});

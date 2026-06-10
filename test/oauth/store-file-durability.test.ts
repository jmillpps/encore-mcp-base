import assert from "node:assert/strict";
import { chmod, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StoreFile } from "../../auth/storage/store-file.ts";

const validHash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("OAuth store writes owner metadata into active lock files", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-lock-metadata-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  const lockPath = `${path}.lock`;
  await new StoreFile(path).update(async (state) => {
    state.rateLimits[validHash] = { windowStart: 0, previousCount: 0, currentCount: 1, expiresAt: 10 };
    const metadata = JSON.parse(await readFile(lockPath, "utf8")) as Record<string, unknown>;
    assert.equal(typeof metadata.token, "string");
    assert.equal(metadata.pid, process.pid);
    assert.equal(typeof metadata.hostname, "string");
    assert.equal(typeof metadata.createdAtMs, "number");
    assert.equal(typeof metadata.staleAtMs, "number");
    assert.equal(Number(metadata.staleAtMs) > Number(metadata.createdAtMs), true);
  });
  await assert.rejects(() => readFile(lockPath, "utf8"), /ENOENT/);
});

test("OAuth store recovers expired lock metadata before updating", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-stale-lock-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  await writeStoreJson(path, {});
  await writeStoreText(`${path}.lock`, JSON.stringify({
    token: "stale-lock-token",
    pid: 1,
    hostname: "stale-host",
    createdAtMs: Date.now() - 60000,
    staleAtMs: Date.now() - 30000,
  }));
  await new StoreFile(path).update((state) => {
    state.rateLimits[validHash] = { windowStart: 0, previousCount: 0, currentCount: 1, expiresAt: 10 };
  });
  const state = await new StoreFile(path).read();
  assert.deepEqual(Object.keys(state.rateLimits), [validHash]);
  await assert.rejects(() => readFile(`${path}.lock`, "utf8"), /ENOENT/);
});

test("OAuth store cleans temp files after durable replacement", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-temp-cleanup-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  await new StoreFile(path).update((state) => {
    state.rateLimits[validHash] = { windowStart: 0, previousCount: 0, currentCount: 1, expiresAt: 10 };
  });
  const entries = await readdir(dir);
  assert.deepEqual(entries, ["store.json"]);
});

async function writeStoreJson(path: string, value: Record<string, unknown>): Promise<void> {
  await writeStoreText(path, JSON.stringify(value));
}

async function writeStoreText(path: string, value: string): Promise<void> {
  await writeFile(path, value, { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600);
}

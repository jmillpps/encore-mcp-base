import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StoreFile } from "../../auth/storage/store-file.ts";

test("OAuth store rejects existing files readable outside the owner", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-permissions-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const path = join(dir, "store.json");
  await writeFile(path, "{}\n", { encoding: "utf8", mode: 0o644 });
  await chmod(path, 0o644);
  await assert.rejects(() => new StoreFile(path).read(), /store file permissions must be owner-only/);
});

test("OAuth store rejects symlinked store files", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "mcp-oauth-store-symlink-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const target = join(dir, "target.json");
  const path = join(dir, "store.json");
  await writeSecureStoreFile(target, "{}\n");
  await symlink(target, path);
  await assert.rejects(() => new StoreFile(path).read(), /store file cannot be a symlink/);
});

async function writeSecureStoreFile(path: string, value: string): Promise<void> {
  await writeFile(path, value, { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600);
}

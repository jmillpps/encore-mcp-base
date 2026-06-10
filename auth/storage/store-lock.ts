import { constants } from "node:fs";
import { open, rm, stat, type FileHandle } from "node:fs/promises";
import { hostname } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { randomToken } from "../../shared/crypto.ts";

const lockPollMs = 10;
const lockTimeoutMs = 5000;
const staleLockMs = 300000;

interface StoreLock {
  path: string;
  handle: FileHandle;
  metadata: StoreLockMetadata;
}

interface StoreLockMetadata {
  token: string;
  pid: number;
  hostname: string;
  createdAtMs: number;
  staleAtMs: number;
}

export async function withStoreLock<T>(path: string, work: () => Promise<T>): Promise<T> {
  const lockPath = `${path}.lock`;
  const lock = await acquireLock(lockPath);
  try {
    return await work();
  } finally {
    await releaseLock(lock);
  }
}

async function acquireLock(path: string): Promise<StoreLock> {
  const startedAt = Date.now();
  while (true) {
    try {
      return await createLock(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await recoverStaleLock(path);
      if (Date.now() - startedAt >= lockTimeoutMs) throw new Error("store file is locked");
      await delay(lockPollMs);
    }
  }
}

async function createLock(path: string): Promise<StoreLock> {
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  const now = Date.now();
  const metadata = {
    token: randomToken(18),
    pid: process.pid,
    hostname: hostname(),
    createdAtMs: now,
    staleAtMs: now + staleLockMs,
  };
  try {
    await handle.writeFile(`${JSON.stringify(metadata)}\n`, "utf8");
    await handle.sync();
    return { path, handle, metadata };
  } catch (error) {
    await handle.close();
    await rm(path, { force: true });
    throw error;
  }
}

async function recoverStaleLock(path: string): Promise<void> {
  const metadata = await readLockMetadata(path);
  const expired = metadata ? metadata.staleAtMs <= Date.now() : await lockMtimeExpired(path);
  if (expired) await rm(path, { force: true });
}

async function readLockMetadata(path: string): Promise<StoreLockMetadata | undefined> {
  let handle: FileHandle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    return undefined;
  }
  try {
    return parseLockMetadata(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
}

function parseLockMetadata(text: string): StoreLockMetadata | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.token !== "string" || record.token.length === 0) return undefined;
  if (!Number.isSafeInteger(record.pid)) return undefined;
  if (typeof record.hostname !== "string" || record.hostname.length === 0) return undefined;
  if (!Number.isSafeInteger(record.createdAtMs)) return undefined;
  if (!Number.isSafeInteger(record.staleAtMs)) return undefined;
  return record as unknown as StoreLockMetadata;
}

async function lockMtimeExpired(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return Date.now() - stats.mtimeMs >= staleLockMs;
  } catch {
    return false;
  }
}

async function releaseLock(lock: StoreLock): Promise<void> {
  await lock.handle.close();
  const current = await readLockMetadata(lock.path);
  if (current?.token === lock.metadata.token) await rm(lock.path, { force: true });
}

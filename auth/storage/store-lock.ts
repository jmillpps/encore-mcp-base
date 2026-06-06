import { open, rm, type FileHandle } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const lockPollMs = 10;
const lockTimeoutMs = 5000;

export async function withStoreLock<T>(path: string, work: () => Promise<T>): Promise<T> {
  const lockPath = `${path}.lock`;
  const handle = await acquireLock(lockPath);
  try {
    return await work();
  } finally {
    await releaseLock(lockPath, handle);
  }
}

async function acquireLock(path: string): Promise<FileHandle> {
  const startedAt = Date.now();
  while (true) {
    try {
      return await open(path, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() - startedAt >= lockTimeoutMs) throw new Error("store file is locked");
      await delay(lockPollMs);
    }
  }
}

async function releaseLock(path: string, handle: FileHandle): Promise<void> {
  await handle.close();
  await rm(path, { force: true });
}

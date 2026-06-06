import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";

export function spawnStoreWorker(path: string, key: string, count: number, resetAt: number, waitMs: number, marker?: string) {
  const child = spawn(process.execPath, [
    "--experimental-strip-types",
    join(process.cwd(), "test/support/store-file-update-worker.ts"),
    path,
    key,
    String(count),
    String(resetAt),
    String(waitMs),
    ...(marker ? [marker] : []),
  ], { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  return { child, stderr: () => stderr };
}

export async function waitForStoreWorker(worker: ReturnType<typeof spawnStoreWorker>): Promise<void> {
  if (worker.child.exitCode !== null || worker.child.signalCode !== null) {
    assert.equal(worker.child.signalCode, null, worker.stderr());
    assert.equal(worker.child.exitCode, 0, worker.stderr());
    return;
  }
  const [code, signal] = await once(worker.child, "exit") as [number | null, NodeJS.Signals | null];
  assert.equal(signal, null, worker.stderr());
  assert.equal(code, 0, worker.stderr());
}

export async function waitForStoreWorkerMarker(path: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await readFile(path, "utf8");
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await delay(10);
    }
  }
  throw new Error("worker marker was not created");
}

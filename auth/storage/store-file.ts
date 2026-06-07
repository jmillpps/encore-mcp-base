import { constants } from "node:fs";
import { mkdir, open, rename, writeFile, type FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import { randomToken } from "../../shared/crypto.ts";
import { emptyStoreState, type OAuthStoreState } from "./store-records.ts";
import { normalizeStore, serializeStore } from "./store-codec.ts";
import { withStoreLock } from "./store-lock.ts";
import { resolveStorePath } from "./store-path.ts";

const pathUpdates = new Map<string, Promise<void>>();

export class StoreFile {
  readonly path: string;

  constructor(path: string) {
    this.path = resolveStorePath(path);
  }

  async read(): Promise<OAuthStoreState> {
    let handle: FileHandle;
    try {
      handle = await open(this.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStoreState();
      if ((error as NodeJS.ErrnoException).code === "ELOOP") throw new Error("store file cannot be a symlink");
      throw error;
    }
    try {
      const stats = await handle.stat();
      if (!stats.isFile()) throw new Error("store path must be a regular file");
      assertSecureFileMode(stats.mode);
      const text = await handle.readFile("utf8");
      return normalizeStore(parseStoreJson(text));
    } finally {
      await handle.close();
    }
  }

  async update<T>(fn: (state: OAuthStoreState) => T | Promise<T>): Promise<T> {
    const previous = pathUpdates.get(this.path) ?? Promise.resolve();
    const work = previous.then(async () => {
      await this.ensureDirectory();
      return withStoreLock(this.path, async () => {
        const state = await this.read();
        const result = await fn(state);
        await this.write(state);
        return result;
      });
    });
    const pending = work.then(() => undefined, () => undefined);
    pathUpdates.set(this.path, pending);
    pending.then(() => {
      if (pathUpdates.get(this.path) === pending) pathUpdates.delete(this.path);
    });
    return work;
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
  }

  private async write(state: OAuthStoreState): Promise<void> {
    const temp = `${this.path}.${randomToken(10)}.tmp`;
    await writeFile(temp, `${JSON.stringify(serializeStore(state), null, 2)}\n`, { mode: 0o600 });
    await rename(temp, this.path);
  }
}

function assertSecureFileMode(mode: number): void {
  if ((mode & 0o077) !== 0) throw new Error("store file permissions must be owner-only");
}

function parseStoreJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("store file is malformed");
  }
}

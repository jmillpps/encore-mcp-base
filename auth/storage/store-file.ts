import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomToken } from "../../shared/crypto.ts";
import { emptyStoreState, type OAuthStoreState } from "./store-records.ts";
import { normalizeStore, serializeStore } from "./store-codec.ts";

const pathUpdates = new Map<string, Promise<void>>();

export class StoreFile {
  readonly path: string;

  constructor(path: string) {
    this.path = resolveStorePath(path);
  }

  async read(): Promise<OAuthStoreState> {
    try {
      const text = await readFile(this.path, "utf8");
      return normalizeStore(parseStoreJson(text));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStoreState();
      throw error;
    }
  }

  async update<T>(fn: (state: OAuthStoreState) => T | Promise<T>): Promise<T> {
    const previous = pathUpdates.get(this.path) ?? Promise.resolve();
    const work = previous.then(async () => {
      const state = await this.read();
      const result = await fn(state);
      await this.write(state);
      return result;
    });
    const pending = work.then(() => undefined, () => undefined);
    pathUpdates.set(this.path, pending);
    pending.then(() => {
      if (pathUpdates.get(this.path) === pending) pathUpdates.delete(this.path);
    });
    return work;
  }

  private async write(state: OAuthStoreState): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temp = `${this.path}.${randomToken(10)}.tmp`;
    await writeFile(temp, `${JSON.stringify(serializeStore(state), null, 2)}\n`, { mode: 0o600 });
    await rename(temp, this.path);
  }
}

function resolveStorePath(path: string): string {
  if (!path.trim()) throw new Error("store path is required");
  if (path.split(/[\\/]/).includes("..")) throw new Error("store path cannot traverse upward");
  if (!path.endsWith(".json")) throw new Error("store path must end with .json");
  return resolve(process.cwd(), path);
}

function parseStoreJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("store file is malformed");
  }
}

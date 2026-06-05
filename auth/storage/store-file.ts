import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { randomToken } from "../../shared/crypto.ts";
import { asRecord } from "../../shared/json.ts";
import { emptyStoreState, type OAuthStoreState } from "./store-records.ts";

export class StoreFile {
  private pending: Promise<void> = Promise.resolve();
  readonly path: string;

  constructor(path: string) {
    this.path = resolveStorePath(path);
  }

  async read(): Promise<OAuthStoreState> {
    try {
      const text = await readFile(this.path, "utf8");
      return normalizeStore(JSON.parse(text));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStoreState();
      throw error;
    }
  }

  async update<T>(fn: (state: OAuthStoreState) => T | Promise<T>): Promise<T> {
    const work = this.pending.then(async () => {
      const state = await this.read();
      const result = await fn(state);
      await this.write(state);
      return result;
    });
    this.pending = work.then(() => undefined, () => undefined);
    return work;
  }

  private async write(state: OAuthStoreState): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temp = `${this.path}.${randomToken(10)}.tmp`;
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temp, this.path);
  }
}

function resolveStorePath(path: string): string {
  if (!path.trim()) throw new Error("store path is required");
  if (!isAbsolute(path) && path.split(/[\\/]/).includes("..")) throw new Error("store path cannot traverse upward");
  if (!path.endsWith(".json")) throw new Error("store path must end with .json");
  return resolve(process.cwd(), path);
}

function normalizeStore(value: unknown): OAuthStoreState {
  const record = asRecord(value, "store");
  const state = emptyStoreState();
  state.authorizationCodes = normalizeMap(record.authorizationCodes);
  state.refreshTokens = normalizeMap(record.refreshTokens);
  state.mcpSessions = normalizeMap(record.mcpSessions);
  state.rateLimits = normalizeMap(record.rateLimits);
  return state;
}

function normalizeMap(value: unknown): Record<string, never> {
  if (value === undefined) return {};
  const record = asRecord(value, "store map");
  return record as Record<string, never>;
}

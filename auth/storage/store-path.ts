import { resolve } from "node:path";

export function resolveStorePath(path: string): string {
  if (!path.trim()) throw new Error("store path is required");
  if (path !== path.trim()) throw new Error("store path cannot include surrounding whitespace");
  if (path.split(/[\\/]/).includes("..")) throw new Error("store path cannot traverse upward");
  if (!path.endsWith(".json")) throw new Error("store path must end with .json");
  return resolve(process.cwd(), path);
}

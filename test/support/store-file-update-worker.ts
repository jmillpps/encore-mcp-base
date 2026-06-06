import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { StoreFile } from "../../auth/storage/store-file.ts";

const [path, key, countValue, resetValue, delayValue, markerPath] = process.argv.slice(2);
if (!path || !key || !countValue || !resetValue || !delayValue) throw new Error("missing worker arguments");

await new StoreFile(path).update(async (state) => {
  state.rateLimits[key] = { count: numberArg(countValue), resetAt: numberArg(resetValue) };
  if (markerPath) await writeFile(markerPath, "entered", "utf8");
  await delay(numberArg(delayValue));
});

function numberArg(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("worker argument must be a non-negative integer");
  return parsed;
}

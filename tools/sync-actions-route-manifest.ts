#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatActionRouteManifest, loadGeneratedActionRoutes } from "./openapi-graph.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "actions/action-route-manifest.generated.ts");
const check = parseArgs(process.argv.slice(2));
const routes = await loadGeneratedActionRoutes(root, true);
const output = formatActionRouteManifest(routes);

if (check) {
  const current = await readFile(manifestPath, "utf8").catch(() => "");
  if (current !== output) throw new Error("Actions route manifest is stale; run npm run sync:actions-routes");
} else {
  await writeFile(manifestPath, output);
}

function parseArgs(args: string[]): boolean {
  let check = false;
  for (const arg of args) {
    if (arg === "--check") check = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return check;
}

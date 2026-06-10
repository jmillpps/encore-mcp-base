import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { actionRouteManifest } from "../actions/action-route-manifest.generated.ts";
import { actionOperationDefinitions, assertActionRouteManifest, type ActionName, type ActionRoute } from "../actions/action-contract.ts";

export async function loadValidatedEncoreGraph(root: string, build: boolean): Promise<ActionRoute[]> {
  const routes = await loadGeneratedActionRoutes(root, build);
  assertSameManifest(routes);
  return routes;
}

export async function loadGeneratedActionRoutes(root: string, build: boolean): Promise<ActionRoute[]> {
  if (build) ensureEncoreGraph(root);
  const graph = await readFile(resolve(root, ".encore/build/combined/combined/main.mjs"), "utf8");
  return generatedActionRoutes(graph);
}

export function formatActionRouteManifest(routes: readonly ActionRoute[]): string {
  assertActionRouteManifest(routes);
  const entries = routes.map((route) => `  { name: ${JSON.stringify(route.name)}, method: ${JSON.stringify(route.method)}, path: ${JSON.stringify(route.path)}, auth: ${route.auth} },`);
  return `import type { ActionRoute } from "./action-contract.ts";

export const actionRouteManifest = [
${entries.join("\n")}
] as const satisfies readonly ActionRoute[];
`;
}

function ensureEncoreGraph(root: string): void {
  const result = spawnSync("encore", ["check"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(String(result.stdout));
    process.stderr.write(String(result.stderr));
    throw new Error("encore check failed");
  }
}

function generatedActionRoutes(graph: string): ActionRoute[] {
  const routes = actionOperationDefinitions.map((definition) => generatedActionRoute(graph, definition.name));
  assertActionRouteManifest(routes);
  return routes;
}

function generatedActionRoute(graph: string, name: ActionName): ActionRoute {
  const route = apiRouteObject(graph, name);
  const method = route.match(/\bmethod:\s*"([^"]+)"/)?.[1];
  const path = route.match(/\bpath:\s*"([^"]+)"/)?.[1];
  const auth = /\bauth:\s*true\b/.test(route);
  if (method !== "GET") throw new Error(`generated Encore method mismatch for ${name}`);
  if (!path) throw new Error(`generated Encore path missing for ${name}`);
  assertGeneratedHandler(graph, name, auth);
  return { name, method, path, auth };
}

function apiRouteObject(graph: string, name: ActionName): string {
  const match = new RegExp(`var\\s+${name}\\s*=\\s*api\\d*(?:\\.raw)?\\(\\s*(\\{[\\s\\S]*?\\})\\s*,`).exec(graph);
  if (!match?.[1]) throw new Error(`generated Encore route missing for ${name}`);
  return match[1];
}

function assertGeneratedHandler(graph: string, name: ActionName, auth: boolean): void {
  const handler = new RegExp(`name:\\s*"${name}"[\\s\\S]*?endpointOptions:\\s*\\{[^}]*"auth":\\s*${auth}`);
  if (!handler.test(graph)) throw new Error(`generated Encore auth metadata missing for ${name}`);
}

function assertSameManifest(routes: readonly ActionRoute[]): void {
  if (routes.length !== actionRouteManifest.length) throw new Error("Actions route manifest route count is stale");
  for (const [index, route] of routes.entries()) {
    const expected = actionRouteManifest[index];
    if (!expected || route.name !== expected.name || route.method !== expected.method || route.path !== expected.path || route.auth !== expected.auth) {
      throw new Error(`Actions route manifest is stale for ${route.name}`);
    }
  }
}

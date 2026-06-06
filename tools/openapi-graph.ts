import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const actionRoutes = [
  { name: "health", method: "GET", path: "/health" },
  { name: "profile", method: "GET", path: "/actions/profile" },
  { name: "session", method: "GET", path: "/actions/session" },
];

export async function loadValidatedEncoreGraph(root: string, build: boolean): Promise<string> {
  if (build) ensureEncoreGraph(root);
  const graph = await readFile(resolve(root, ".encore/build/combined/combined/main.mjs"), "utf8");
  validateGeneratedActions(graph);
  return graph;
}

function ensureEncoreGraph(root: string): void {
  const result = spawnSync("encore", ["check"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(String(result.stdout));
    process.stderr.write(String(result.stderr));
    throw new Error("encore check failed");
  }
}

function validateGeneratedActions(graph: string): void {
  for (const route of actionRoutes) {
    if (!graph.includes(`method: "${route.method}", path: "${route.path}"`)) {
      throw new Error(`generated Encore route missing: ${route.method} ${route.path}`);
    }
    if (!graph.includes(`name: "${route.name}"`)) throw new Error(`generated Encore handler missing: ${route.name}`);
  }
  for (const name of ["profile", "session"]) {
    const handler = new RegExp(`name:\\s*"${name}"[\\s\\S]*?endpointOptions:\\s*\\{[^}]*"auth":\\s*true`);
    if (!handler.test(graph)) throw new Error(`generated Encore auth metadata missing: ${name}`);
  }
}

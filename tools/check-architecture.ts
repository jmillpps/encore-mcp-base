import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const roots = ["actions", "auth", "mcp", "shared"];
const failures: string[] = [];

function walk(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      const stat = statSync(path);
      return stat.isDirectory() ? walk(path) : [path];
    });
  } catch {
    return [];
  }
}

function rootOf(file: string): string {
  return normalize(file).split("/")[0] ?? "";
}

for (const file of roots.flatMap(walk).filter((path) => path.endsWith(".ts"))) {
  const from = rootOf(file);
  const text = readFileSync(file, "utf8");
  const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].flatMap((match) => (match[1] ? [match[1]] : []));
  for (const specifier of imports) {
    if (!specifier.startsWith("../")) continue;
    const target = normalize(join(file, "..", specifier));
    const to = rootOf(target);
    if (from === "shared" && to !== "shared") failures.push(`${file} imports ${specifier}`);
    if (from === "auth" && (to === "mcp" || to === "actions")) failures.push(`${file} imports ${specifier}`);
    if ((from === "actions" || from === "mcp") && to === "test") failures.push(`${file} imports ${specifier}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

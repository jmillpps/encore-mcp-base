import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const codeRoots = ["actions", "auth", "mcp", "shared", "tools"];
const testRoots = ["test"];
const maxRuntime = 220;
const maxTest = 300;
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

for (const root of codeRoots) {
  for (const file of walk(root).filter((path) => path.endsWith(".ts"))) {
    const lines = readFileSync(file, "utf8").split("\n").length;
    if (lines > maxRuntime) failures.push(`${file} has ${lines} lines`);
    if (file.endsWith("utils.ts")) failures.push(`${file} uses forbidden utils.ts name`);
  }
}

for (const root of testRoots) {
  for (const file of walk(root).filter((path) => path.endsWith(".ts"))) {
    const lines = readFileSync(file, "utf8").split("\n").length;
    if (lines > maxTest) failures.push(`${file} has ${lines} lines`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

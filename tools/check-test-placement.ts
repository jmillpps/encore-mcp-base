import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const failures: string[] = [];
const markdownPattern = /\.(md|mdx)(["'`)]|$)/i;

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

for (const file of walk(".")) {
  if (file.includes("node_modules/") || file.includes(".git/")) continue;
  if (file.endsWith(".test.ts") && !file.startsWith("test/")) failures.push(`${file} must live under test/`);
}

for (const file of walk("test").filter((path) => path.endsWith(".ts"))) {
  const text = readFileSync(file, "utf8");
  if (markdownPattern.test(text)) failures.push(`${file} references Markdown`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

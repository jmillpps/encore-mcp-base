import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const runtime = Object.keys(pkg.dependencies ?? {});
const allowed = new Set(["encore.dev"]);
const unexpected = runtime.filter((name) => !allowed.has(name));

if (unexpected.length > 0) {
  console.error(`Unexpected runtime dependencies: ${unexpected.join(", ")}`);
  process.exit(1);
}

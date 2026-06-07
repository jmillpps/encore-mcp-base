import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
import { createSourceArchive } from "../../tools/source-archive.ts";

test("source archive contains runtime files and excludes deployment tooling", async () => {
  const repo = await createRepo();
  try {
    await writeFile(join(repo, ".gitignore"), "local-instructions.txt\nlocal-plan.txt\nnode_modules/\n");
    await writeRuntimeFiles(repo);
    await mkdir(join(repo, "ci/cdk/src"), { recursive: true });
    await mkdir(join(repo, "test/cdk"), { recursive: true });
    await mkdir(join(repo, "docs/deployment"), { recursive: true });
    await mkdir(join(repo, "tools"), { recursive: true });
    await writeFile(join(repo, "ci/cdk/src/app.ts"), "export const deployment = true;\n");
    await writeFile(join(repo, "test/cdk/example.test.ts"), "export const testFile = true;\n");
    await writeFile(join(repo, "docs/deployment/runtime.txt"), "deployment notes\n");
    await writeFile(join(repo, "tools/example.ts"), "export const tool = true;\n");
    await writeFile(join(repo, "local-instructions.txt"), "local instructions\n");
    await writeFile(join(repo, "local-plan.txt"), "local plan\n");
    await commitAll(repo);
    const archive = join(repo, "source.zip");
    await createSourceArchive(repo, archive);
    const entries = (await spawnFile("unzip", ["-Z1", archive])).split("\n").filter(Boolean);
    assert.ok(entries.includes("actions/encore.service.ts"));
    assert.ok(entries.includes("auth/encore.service.ts"));
    assert.ok(entries.includes("mcp/encore.service.ts"));
    assert.ok(entries.includes("shared/config.ts"));
    assert.ok(entries.includes("encore.app"));
    assert.ok(entries.includes("package.json"));
    assert.ok(entries.includes("package-lock.json"));
    assert.ok(entries.includes("tsconfig.json"));
    assert.equal(entries.includes(".gitignore"), false);
    assert.equal(entries.includes("ci/cdk/src/app.ts"), false);
    assert.equal(entries.includes("test/cdk/example.test.ts"), false);
    assert.equal(entries.includes("docs/deployment/runtime.txt"), false);
    assert.equal(entries.includes("tools/example.ts"), false);
    assert.equal(entries.includes("local-instructions.txt"), false);
    assert.equal(entries.includes("local-plan.txt"), false);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("source archive rejects untracked source files", async () => {
  const repo = await createRepo();
  try {
    await writeFile(join(repo, ".gitignore"), "local-instructions.txt\n");
    await writeRuntimeFiles(repo);
    await commitAll(repo);
    await writeFile(join(repo, "actions/new.ts"), "export const next = 2;\n");
    await assert.rejects(createSourceArchive(repo, join(repo, "source.zip")), /uncommitted tracked or untracked files/);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

async function createRepo(): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), "source-archive-test-"));
  await spawnFile("git", ["init"], { cwd: repo });
  return repo;
}

async function writeRuntimeFiles(repo: string): Promise<void> {
  await mkdir(join(repo, "actions"), { recursive: true });
  await mkdir(join(repo, "auth"), { recursive: true });
  await mkdir(join(repo, "mcp"), { recursive: true });
  await mkdir(join(repo, "shared"), { recursive: true });
  await writeFile(join(repo, "actions/encore.service.ts"), "export const actions = true;\n");
  await writeFile(join(repo, "auth/encore.service.ts"), "export const auth = true;\n");
  await writeFile(join(repo, "mcp/encore.service.ts"), "export const mcp = true;\n");
  await writeFile(join(repo, "shared/config.ts"), "export const config = true;\n");
  await writeFile(join(repo, "encore.app"), "{}\n");
  await writeFile(join(repo, "package.json"), "{}\n");
  await writeFile(join(repo, "package-lock.json"), "{}\n");
  await writeFile(join(repo, "tsconfig.json"), "{}\n");
}

async function commitAll(repo: string): Promise<void> {
  await spawnFile("git", ["add", "."], { cwd: repo });
  await spawnFile("git", ["-c", "user.name=Test User", "-c", "user.email=test@example.test", "commit", "-m", "initial"], { cwd: repo });
}

async function spawnFile(command: string, args: string[], options: { cwd?: string } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${command} ${args.join(" ")} failed with ${code}\n${stderr}`));
    });
  });
}

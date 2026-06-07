import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
import { createSourceArchive } from "../../tools/source-archive.ts";

test("source archive contains committed files and excludes ignored local files", async () => {
  const repo = await createRepo();
  try {
    await writeFile(join(repo, ".gitignore"), "local-instructions.txt\nlocal-plan.txt\nnode_modules/\n");
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src/index.ts"), "export const value = 1;\n");
    await writeFile(join(repo, "local-instructions.txt"), "local instructions\n");
    await writeFile(join(repo, "local-plan.txt"), "local plan\n");
    await commitAll(repo);
    const archive = join(repo, "source.zip");
    await createSourceArchive(repo, archive);
    const entries = (await spawnFile("unzip", ["-Z1", archive])).split("\n").filter(Boolean);
    assert.ok(entries.includes(".gitignore"));
    assert.ok(entries.includes("src/index.ts"));
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
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src/index.ts"), "export const value = 1;\n");
    await commitAll(repo);
    await writeFile(join(repo, "src/new.ts"), "export const next = 2;\n");
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

import { spawn } from "node:child_process";

export const serviceSourceArchivePaths = [
  "actions",
  "auth",
  "mcp",
  "shared",
  "encore.app",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
];

export async function createSourceArchive(projectRoot: string, outputPath: string, paths: string[] = serviceSourceArchivePaths): Promise<void> {
  await assertCleanSourceTree(projectRoot);
  await spawnFile("git", ["archive", "--format=zip", "--output", outputPath, "HEAD", ...paths], { cwd: projectRoot });
}

async function assertCleanSourceTree(projectRoot: string): Promise<void> {
  const status = await spawnFile("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: projectRoot });
  if (status.trim()) throw new Error("source tree has uncommitted tracked or untracked files");
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
